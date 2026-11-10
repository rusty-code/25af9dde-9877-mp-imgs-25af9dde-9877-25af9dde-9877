import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ErrorBanner from '../components/ErrorBanner';
import Map from '../components/Map';
import { useMarkers } from '../context/MarkersContext';


function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export default function MapScreen() {
  const { markers, addMarker } = useMarkers();
  const [error, setError] = useState<string | null>(null);

  const handleLongPress = useCallback(
    (latitude: number, longitude: number) => {
      try {
        addMarker(latitude, longitude);
        setError(null);
      } catch (exception) {
        setError(`Не удалось добавить маркер: ${toErrorMessage(exception)}`);
      }
    },
    [addMarker]
  );

  const openMarker = useCallback(
    (id: string) => {
      if (!markers.some((marker) => marker.id === id)) {
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
