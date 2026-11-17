import type * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  areLocationServicesEnabled,
  getInitialLocation,
  logProviderStatus,
  requestLocationPermissions,
  startLocationUpdates,
  toUserLocation,
} from '../services/location';
import type { UserLocation } from '../types';

export interface UseUserLocationResult {
  location: UserLocation | null;
  isLoading: boolean;
  permissionDenied: boolean;
  error: string | null;
  retry: () => void;
  clearError: () => void;
}

const FALLBACK_POLL_INTERVAL_MS = 15000;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const hasLocationRef = useRef(false);

  useEffect(() => {
    hasLocationRef.current = location !== null;
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    setIsLoading(true);
    setError(null);

    const applyLocation = (next: Location.LocationObject | null) => {
      if (cancelled || !next) {
        return;
      }
      hasLocationRef.current = true;
      setLocation(toUserLocation(next));
      setError(null);
    };

    const setup = async () => {
      try {
        void logProviderStatus();

        const servicesEnabled = await areLocationServicesEnabled();
        if (cancelled) {
          return;
        }
        if (!servicesEnabled) {
          setPermissionDenied(false);
          setError(
            'Службы геолокации выключены. Включите GPS в настройках устройства.'
          );
          return;
        }

        const granted = await requestLocationPermissions();
        if (cancelled) {
          return;
        }
        if (!granted) {
          setPermissionDenied(true);
          setError(
            'Нет доступа к геолокации. Разрешите доступ к местоположению в настройках устройства.'
          );
          return;
        }

        setPermissionDenied(false);

        subscription = await startLocationUpdates(
          (next) => {
            applyLocation(next);
          },
          (reason) => {
            if (!cancelled) {
              setError(`Не удалось обновить местоположение: ${reason}`);
            }
          }
        );

        if (cancelled) {
          subscription.remove();
          subscription = null;
          return;
        }

        void getInitialLocation().then(applyLocation);

        fallbackTimer = setInterval(() => {
          if (cancelled) {
            return;
          }
          if (!hasLocationRef.current) {
            void getInitialLocation(8000).then(applyLocation);
          }
        }, FALLBACK_POLL_INTERVAL_MS);
      } catch (exception) {
        if (!cancelled) {
          setError(
            `Не удалось определить местоположение: ${toErrorMessage(exception)}`
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) {
        clearInterval(fallbackTimer);
      }
      subscription?.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !hasLocationRef.current) {
        setAttempt((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { location, isLoading, permissionDenied, error, retry, clearError };
}
