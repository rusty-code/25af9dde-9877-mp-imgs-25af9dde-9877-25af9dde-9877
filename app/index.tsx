import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ErrorBanner from '../components/ErrorBanner';
import Map from '../components/Map';
import { useDatabase } from '../context/DatabaseContext';
import { parsePositiveInteger } from '../types';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export default function MapScreen() {
  const { markers, addMarker } = useDatabase();
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleLongPress = useCallback(
    (latitude: number, longitude: number) => {
      if (isAdding) {
        return;
      }

      setIsAdding(true);
      setError(null);

      addMarker(latitude, longitude)
        .then(() => {
          setError(null);
        })
        .catch((exception) => {
          setError(`Не удалось добавить маркер: ${toErrorMessage(exception)}`);
        })
        .finally(() => {
          setIsAdding(false);
        });
    },
    [addMarker, isAdding]
  );

  const openMarker = useCallback(
    (rawId: string) => {
      const id = parsePositiveInteger(rawId);
      if (id === null || !markers.some((marker) => marker.id === id)) {
        setError('Маркер не найден. Возможно, он был удалён.');
        return;
      }

      try {
        router.push(`/marker/${id}`);
      } catch (exception) {
        setError(`Не удалось открыть экран маркера: ${toErrorMessage(exception)}`);
      }
    },
    [markers]
  );

  return (
    <View style={styles.container}>
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <View style={styles.map}>
        <Map markers={markers} onLongPress={handleLongPress} onMarkerPress={openMarker} />
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Маркеров: {markers.length}. Долгое нажатие по карте добавляет маркер, нажатие на маркер
          открывает его детали.
          {isAdding ? ' Добавление…' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  hint: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f5f5f5' },
  hintText: { color: '#555', fontSize: 12 },
});
