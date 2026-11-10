import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { Marker, MarkerImage } from '../types';

interface MarkersState {
  markers: Marker[];
}

type MarkersAction =
  | { type: 'addMarker'; marker: Marker }
  | { type: 'removeMarker'; id: string }
  | { type: 'addImages'; markerId: string; images: MarkerImage[] }
  | { type: 'removeImage'; markerId: string; imageId: string };

interface MarkersContextValue {
  markers: Marker[];
  /** Добавляет маркер и возвращает его. */
  addMarker: (latitude: number, longitude: number) => Marker;
  /** Удаляет маркер вместе с изображениями. */
  removeMarker: (id: string) => void;
  /** Добавляет изображения к маркеру. */
  addImages: (markerId: string, images: MarkerImage[]) => void;
  /** Удаляет изображение маркера. */
  removeImage: (markerId: string, imageId: string) => void;
  /** Возвращает маркер по идентификатору или `undefined`. */
  getMarker: (id: string) => Marker | undefined;
}

const initialState: MarkersState = { markers: [] };

const MarkersContext = createContext<MarkersContextValue | null>(null);

let idSequence = 0;

/** Генерирует уникальный идентификатор без внешних зависимостей. */
function createId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSequence}`;
}

function markersReducer(state: MarkersState, action: MarkersAction): MarkersState {
  switch (action.type) {
    case 'addMarker':
      return { ...state, markers: [...state.markers, action.marker] };

    case 'removeMarker':
      return {
        ...state,
        markers: state.markers.filter((marker) => marker.id !== action.id),
      };

    case 'addImages': {
      if (action.images.length === 0) {
        return state;
      }
      let found = false;
      const markers = state.markers.map((marker) => {
        if (marker.id !== action.markerId) {
          return marker;
        }
        found = true;
        return { ...marker, images: [...marker.images, ...action.images] };
      });
      return found ? { ...state, markers } : state;
    }

    case 'removeImage': {
      let found = false;
      const markers = state.markers.map((marker) => {
        if (marker.id !== action.markerId) {
          return marker;
        }
        const images = marker.images.filter((image) => image.id !== action.imageId);
        if (images.length === marker.images.length) {
          return marker;
        }
        found = true;
        return { ...marker, images };
      });
      return found ? { ...state, markers } : state;
    }

    default:
      return state;
  }
}

export function MarkersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(markersReducer, initialState);
  const titleCounter = useRef(0);

  const addMarker = useCallback((latitude: number, longitude: number): Marker => {
    titleCounter.current += 1;
    const marker: Marker = {
      id: createId('marker'),
      latitude,
      longitude,
      title: `Точка ${titleCounter.current}`,
      createdAt: Date.now(),
      images: [],
    };
    dispatch({ type: 'addMarker', marker });
    return marker;
  }, []);

  const removeMarker = useCallback((id: string) => {
    dispatch({ type: 'removeMarker', id });
  }, []);

  const addImages = useCallback((markerId: string, images: MarkerImage[]) => {
    dispatch({ type: 'addImages', markerId, images });
  }, []);

  const removeImage = useCallback((markerId: string, imageId: string) => {
    dispatch({ type: 'removeImage', markerId, imageId });
  }, []);

  const { markers } = state;

  const getMarker = useCallback(
    (id: string) => markers.find((marker) => marker.id === id),
    [markers]
  );

  const value = useMemo<MarkersContextValue>(
    () => ({ markers, addMarker, removeMarker, addImages, removeImage, getMarker }),
    [markers, addMarker, removeMarker, addImages, removeImage, getMarker]
  );

  return <MarkersContext.Provider value={value}>{children}</MarkersContext.Provider>;
}

/** Доступ к состоянию маркеров. Бросает ошибку вне провайдера. */
export function useMarkers(): MarkersContextValue {
  const context = useContext(MarkersContext);
  if (!context) {
    throw new Error('useMarkers должен использоваться внутри <MarkersProvider>');
  }
  return context;
}

/** Создаёт объект изображения для маркера. */
export function createMarkerImage(asset: {
  uri: string;
  width?: number | null;
  height?: number | null;
}): MarkerImage {
  return {
    id: createId('image'),
    uri: asset.uri,
    width: typeof asset.width === 'number' ? asset.width : null,
    height: typeof asset.height === 'number' ? asset.height : null,
    createdAt: Date.now(),
  };
}
