import * as Location from 'expo-location';

import type { UserLocation } from '../types';


export const ENTER_ZONE_RADIUS_M = 100;

export const EXIT_ZONE_RADIUS_M = 150;

export const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 0,
  mayShowUserSettingsDialog: true,
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function toUserLocation(
  location: Location.LocationObject
): UserLocation {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
  };
}

export async function areLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch (error) {
    if (__DEV__) {
      console.error('[location] hasServicesEnabledAsync', error);
    }
    return true;
  }
}


export async function requestLocationPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}


export async function startLocationUpdates(
  onLocation: (location: Location.LocationObject) => void,
  onError?: (message: string) => void
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(LOCATION_OPTIONS, onLocation, (reason) => {
    if (__DEV__) {
      console.error('[location] watchPositionAsync', reason);
    }
    onError?.(reason);
  });
}

export async function getInitialLocation(
  timeoutMs = 10000
): Promise<Location.LocationObject | null> {
  try {
    const cached = await Location.getLastKnownPositionAsync({
      maxAge: 300000,
      requiredAccuracy: 1000,
    });
    if (cached) {
      return cached;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[location] getLastKnownPositionAsync', error);
    }
  }

  const request = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  }).catch((error: unknown) => {
    if (__DEV__) {
      console.error('[location] getCurrentPositionAsync', error);
    }
    return null;
  });

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([request, timeout]);
}

export async function logProviderStatus(): Promise<void> {
  if (!__DEV__) {
    return;
  }

  try {
    const status = await Location.getProviderStatusAsync();
    console.log('[location] providers', {
      servicesEnabled: status.locationServicesEnabled,
      gpsAvailable: status.gpsAvailable,
      networkAvailable: status.networkAvailable,
      passiveAvailable: status.passiveAvailable,
    });
  } catch (error) {
    console.error('[location] getProviderStatusAsync', error);
  }
}
