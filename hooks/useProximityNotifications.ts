import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  ENTER_ZONE_RADIUS_M,
  EXIT_ZONE_RADIUS_M,
  calculateDistance,
} from '../services/location';
import {
  ensureNotificationPermissions,
  notificationManager,
} from '../services/notifications';
import type { Marker, UserLocation } from '../types';

export interface UseProximityNotificationsResult {
  notificationsEnabled: boolean;
  permissionDenied: boolean;
  error: string | null;
  retryPermission: () => void;
  clearError: () => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function useProximityNotifications(
  location: UserLocation | null,
  markers: Marker[]
): UseProximityNotificationsResult {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const insideZoneRef = useRef<Set<number>>(new Set());
  const failedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      insideZoneRef.current.clear();
      failedRef.current.clear();
      notificationManager.clear().catch((exception) => {
        if (__DEV__) {
          console.error('[proximity] clear', exception);
        }
      });
    };
  }, []);

  const refreshPermissions = useCallback(() => {
    let cancelled = false;

    ensureNotificationPermissions()
      .then((granted) => {
        if (cancelled) {
          return;
        }
        setNotificationsEnabled(granted);
        setPermissionDenied(!granted);
        if (!granted) {
          setError(
            'Уведомления отключены. Разрешите уведомления в настройках устройства, чтобы получать оповещения о приближении к меткам.'
          );
        }
      })
      .catch((exception) => {
        if (!cancelled) {
          setNotificationsEnabled(false);
          setError(
            `Не удалось включить уведомления: ${toErrorMessage(exception)}`
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refreshPermissions(), [attempt, refreshPermissions]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        failedRef.current.clear();
        refreshPermissions();
      }
    });

    return () => subscription.remove();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!notificationsEnabled) {
      return;
    }

    notificationManager
      .syncMarkers(markers.map((marker) => marker.id))
      .catch((exception) => {
        if (__DEV__) {
          console.error('[proximity] syncMarkers', exception);
        }
      });

    const existingIds = new Set(markers.map((marker) => marker.id));
    for (const set of [insideZoneRef.current, failedRef.current]) {
      set.forEach((markerId) => {
        if (!existingIds.has(markerId)) {
          set.delete(markerId);
        }
      });
    }
  }, [markers, notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled || !location) {
      return;
    }

    let cancelled = false;

    for (const marker of markers) {
      if (failedRef.current.has(marker.id)) {
        continue;
      }

      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        marker.latitude,
        marker.longitude
      );
      const isInside = insideZoneRef.current.has(marker.id);

      if (!isInside && distance <= ENTER_ZONE_RADIUS_M) {
        insideZoneRef.current.add(marker.id);
        notificationManager.showNotification(marker).catch((exception) => {
          insideZoneRef.current.delete(marker.id);
          failedRef.current.add(marker.id);
          if (!cancelled) {
            setError(toErrorMessage(exception));
          }
        });
      } else if (isInside && distance > EXIT_ZONE_RADIUS_M) {
        insideZoneRef.current.delete(marker.id);
        failedRef.current.delete(marker.id);
        notificationManager.removeNotification(marker.id).catch((exception) => {
          if (__DEV__) {
            console.error('[proximity] removeNotification', exception);
          }
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [location, markers, notificationsEnabled]);

  const retryPermission = useCallback(() => {
    setError(null);
    failedRef.current.clear();
    setAttempt((value) => value + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    notificationsEnabled,
    permissionDenied,
    error,
    retryPermission,
    clearError,
  };
}
