import type { SQLiteDatabase } from 'expo-sqlite';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  deleteImageById,
  deleteMarkerCascade,
  insertImage,
  insertMarker,
  selectImagesByMarker,
  selectMarkers,
} from '../database/operations';
import { initDatabase } from '../database/schema';
import type { Marker, MarkerImage } from '../types';

export interface DatabaseContextValue {
  markers: Marker[];
  addMarker: (latitude: number, longitude: number) => Promise<number>;
  deleteMarker: (id: number) => Promise<void>;
  getMarkers: () => Promise<Marker[]>;
  addImage: (markerId: number, uri: string) => Promise<void>;
  deleteImage: (id: number) => Promise<void>;
  getMarkerImages: (markerId: number) => Promise<MarkerImage[]>;
  isLoading: boolean;
  error: Error | null;
  clearError: () => void;
  retryInit: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

function asError(exception: unknown): Error {
  return exception instanceof Error ? exception : new Error(String(exception));
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const dbRef = useRef<SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: SQLiteDatabase | null = null;

    dbRef.current = null;
    setDb(null);
    setMarkers([]);
    setError(null);
    setIsLoading(true);

    const load = async () => {
      try {
        opened = await initDatabase();
        if (cancelled) {
          await opened.closeAsync().catch(() => undefined);
          return;
        }

        dbRef.current = opened;
        const list = await selectMarkers(opened);
        if (cancelled) {
          return;
        }

        setDb(opened);
        setMarkers(list);
      } catch (exception) {
        if (!cancelled) {
          setError(asError(exception));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      const current = dbRef.current ?? opened;
      dbRef.current = null;

      if (current) {
        current.closeAsync().catch((closeError) => {
          if (__DEV__) {
            console.error('[db] close', closeError);
          }
        });
      }
    };
  }, [initAttempt]);

  const retryInit = useCallback(() => {
    setError(null);
    setInitAttempt((attempt) => attempt + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const runWithDb = useCallback(
    async function runWithDb<T>(
      task: (database: SQLiteDatabase) => Promise<T>
    ): Promise<T> {
      try {
        const database = dbRef.current;
        if (!database) {
          throw new Error('База данных не инициализирована.');
        }

        const result = await task(database);
        setError(null);
        return result;
      } catch (exception) {
        const dbError = asError(exception);
        setError(dbError);
        throw dbError;
      }
    },
    []
  );

  const getMarkers = useCallback(
    () =>
      runWithDb(async (database) => {
        const list = await selectMarkers(database);
        setMarkers(list);
        return list;
      }),
    [runWithDb]
  );

  const addMarker = useCallback(
    (latitude: number, longitude: number) =>
      runWithDb(async (database) => {
        const id = await insertMarker(database, latitude, longitude);
        const list = await selectMarkers(database);
        setMarkers(list);
        return id;
      }),
    [runWithDb]
  );

  const deleteMarker = useCallback(
    (id: number) =>
      runWithDb(async (database) => {
        await deleteMarkerCascade(database, id);
        const list = await selectMarkers(database);
        setMarkers(list);
      }),
    [runWithDb]
  );

  const addImage = useCallback(
    (markerId: number, uri: string) =>
      runWithDb(async (database) => {
        await insertImage(database, markerId, uri);
      }),
    [runWithDb]
  );

  const deleteImage = useCallback(
    (id: number) =>
      runWithDb(async (database) => {
        await deleteImageById(database, id);
      }),
    [runWithDb]
  );

  const getMarkerImages = useCallback(
    (markerId: number) =>
      runWithDb((database) => selectImagesByMarker(database, markerId)),
    [runWithDb]
  );

  const value = useMemo<DatabaseContextValue>(
    () => ({
      markers,
      addMarker,
      deleteMarker,
      getMarkers,
      addImage,
      deleteImage,
      getMarkerImages,
      isLoading,
      error,
      clearError,
      retryInit,
    }),
    [
      markers,
      addMarker,
      deleteMarker,
      getMarkers,
      addImage,
      deleteImage,
      getMarkerImages,
      isLoading,
      error,
      clearError,
      retryInit,
    ]
  );

  if (isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.stateText}>Загрузка базы данных…</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Не удалось открыть базу данных</Text>
        <Text style={styles.errorText}>
          {error?.message ?? 'Неизвестная ошибка инициализации.'}
        </Text>
        <Pressable style={styles.button} onPress={retryInit}>
          <Text style={styles.buttonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase должен использоваться внутри <DatabaseProvider>');
  }
  return context;
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  stateText: { color: '#333' },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#b00020' },
  errorText: { color: '#333', textAlign: 'center' },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1f6feb',
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
