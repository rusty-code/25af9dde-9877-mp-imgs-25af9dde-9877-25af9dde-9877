export interface MarkerImage {
  id: number;
  markerId: number;
  uri: string;
  createdAt: number;
}

export interface Marker {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  createdAt: number;
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface MarkerDetailsParams {
  id: string;
}

export type RootStackParamList = {
  index: undefined;
  'marker/[id]': MarkerDetailsParams;
};

export type MapMessage =
  | { type: 'ready' }
  | { type: 'longpress'; latitude: number; longitude: number }
  | { type: 'markerpress'; id: string }
  | { type: 'linkpress'; url: string }
  | { type: 'error'; message: string };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseMapMessage(raw: string): MapMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const message = data as Record<string, unknown>;

  switch (message.type) {
    case 'ready':
      return { type: 'ready' };
    case 'longpress':
      if (
        isFiniteNumber(message.latitude) &&
        isFiniteNumber(message.longitude) &&
        Math.abs(message.latitude) <= 90 &&
        Math.abs(message.longitude) <= 180
      ) {
        return {
          type: 'longpress',
          latitude: message.latitude,
          longitude: message.longitude,
        };
      }
      return null;
    case 'markerpress':
      if (typeof message.id === 'string' && message.id.length > 0) {
        return { type: 'markerpress', id: message.id };
      }
      return null;
    case 'linkpress':
      if (typeof message.url === 'string' && /^https?:\/\//i.test(message.url)) {
        return { type: 'linkpress', url: message.url };
      }
      return null;
    case 'error':
      if (typeof message.message === 'string') {
        return { type: 'error', message: message.message };
      }
      return null;
    default:
      return null;
  }
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
