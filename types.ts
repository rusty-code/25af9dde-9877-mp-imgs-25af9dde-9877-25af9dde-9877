/**
 * Общие типы приложения: маркеры, изображения и параметры навигации.
 */

/** Изображение, привязанное к маркеру. */
export interface MarkerImage {
  /** Уникальный идентификатор изображения в локальной БД. */
  id: number;
  /** Идентификатор маркера, к которому привязано изображение. */
  markerId: number;
  /** Локальный URI файла изображения. */
  uri: string;
  /** Время добавления (мс). */
  createdAt: number;
}

/** Точка на карте. Изображения загружаются отдельно по markerId. */
export interface Marker {
  /** Уникальный идентификатор маркера в локальной БД. */
  id: number;
  latitude: number;
  longitude: number;
  /** Подпись маркера (формируется из id). */
  title: string;
  /** Время создания (мс). */
  createdAt: number;
}

/** Данные маркера, которые передаются в WebView с картой. */
export interface MapMarker {
  /** В WebView идентификатор передаётся строкой. */
  id: string;
  latitude: number;
  longitude: number;
  title: string;
}

/** Текущее местоположение пользователя (для карты). */
export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Радиус точности в метрах (если известен). */
  accuracy: number | null;
}

/** Параметры маршрута экрана деталей маркера. */
export interface MarkerDetailsParams {
  id: string;
}

/** Типизация маршрутов приложения. */
export type RootStackParamList = {
  index: undefined;
  'marker/[id]': MarkerDetailsParams;
};

/** Сообщения, которые приходят из WebView с картой. */
export type MapMessage =
  | { type: 'ready' }
  | { type: 'longpress'; latitude: number; longitude: number }
  | { type: 'markerpress'; id: string }
  | { type: 'linkpress'; url: string }
  | { type: 'error'; message: string };

/** Проверяет, что значение является конечным числом. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Разбирает положительный целочисленный идентификатор.
 * Подходит для id из БД, route-параметров и сообщений WebView.
 */
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

/**
 * Разбирает и валидирует сообщение из WebView.
 * Возвращает `null`, если сообщение некорректное.
 */
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

/** Формирует подпись с координатами. */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
