/**
 * Общие типы приложения: маркеры, изображения и параметры навигации.
 */

/** Изображение, привязанное к маркеру. */
export interface MarkerImage {
  /** Уникальный идентификатор изображения. */
  id: string;
  /** Локальный URI файла изображения. */
  uri: string;
  /** Ширина в пикселях (если известна). */
  width: number | null;
  /** Высота в пикселях (если известна). */
  height: number | null;
  /** Время добавления (мс). */
  createdAt: number;
}

/** Точка на карте с привязанными изображениями. */
export interface Marker {
  id: string;
  latitude: number;
  longitude: number;
  /** Подпись маркера. */
  title: string;
  /** Время создания (мс). */
  createdAt: number;
  /** Список изображений маркера. */
  images: MarkerImage[];
}

/** Данные маркера, которые передаются в WebView с картой. */
export type MapMarker = Pick<Marker, 'id' | 'latitude' | 'longitude' | 'title'>;

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
