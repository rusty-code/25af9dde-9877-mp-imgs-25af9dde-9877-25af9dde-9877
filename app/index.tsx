import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import ErrorBanner from '../components/ErrorBanner';
import Map from '../components/Map';
import { useDatabase } from '../context/DatabaseContext';
import { useProximityNotifications } from '../hooks/useProximityNotifications';
import { useUserLocation } from '../hooks/useUserLocation';
import { formatCoordinates, parsePositiveInteger } from '../types';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function openSettings() {
  Linking.openSettings().catch(() => {});
}

export default function MapScreen() {
  const { markers, addMarker } = useDatabase();
  const {
    location,
    isLoading: isLocating,
    permissionDenied: locationDenied,
    error: locationError,
    retry: retryLocation,
    clearError: clearLocationError,
  } = useUserLocation();
  const {
    notificationsEnabled,
    error: notificationError,
    retryPermission: retryNotifications,
    clearError: clearNotificationError,
  } = useProximityNotifications(location, markers);

  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const isAddingRef = useRef(false);

  const handleLongPress = useCallback(
    (latitude: number, longitude: number) => {
      if (isAddingRef.current) {
        return;
      }

      isAddingRef.current = true;
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
          isAddingRef.current = false;
          setIsAdding(false);
        });
    },
    [addMarker]
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

  const statusText = (() => {
    if (isLocating) {
      return 'Определяем местоположение…';
    }
    if (locationDenied) {
      return 'Нет доступа к геолокации.';
    }
    if (location) {
      return `Вы здесь: ${formatCoordinates(location.latitude, location.longitude)}`;
    }
    return 'Местоположение неизвестно.';
  })();

  return (
    <View style={styles.container}>
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {locationError ? (
        <ErrorBanner message={locationError} onDismiss={clearLocationError} />
      ) : null}
      {notificationError ? (
        <ErrorBanner message={notificationError} onDismiss={clearNotificationError} />
      ) : null}

      <View style={styles.map}>
        <Map
          markers={markers}
          userLocation={location}
          onLongPress={handleLongPress}
          onMarkerPress={openMarker}
        />
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.hintText}>
          Маркеров: {markers.length}
          {isAdding ? ' · добавление…' : ''}
        </Text>
        <Text style={styles.statusText}>{statusText}</Text>
        <Text style={styles.hintText}>
          Долгое нажатие по карте добавляет маркер. Уведомления:{' '}
          {notificationsEnabled ? 'включены' : 'выключены'}.
        </Text>

        {locationDenied || locationError ? (
          <View style={styles.actionsRow}>
            <Pressable style={styles.button} onPress={retryLocation}>
              <Text style={styles.buttonText}>Запросить доступ</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={openSettings}>
              <Text style={styles.secondaryButtonText}>Настройки</Text>
            </Pressable>
          </View>
        ) : null}

        {(!notificationsEnabled || notificationError) && !locationDenied ? (
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.button}
              onPress={() => {
                clearNotificationError();
                retryNotifications();
              }}
            >
              <Text style={styles.buttonText}>Включить уведомления</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={openSettings}>
              <Text style={styles.secondaryButtonText}>Настройки</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  bottomBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    gap: 4,
  },
  statusText: { color: '#111', fontSize: 12, fontWeight: '600' },
  hintText: { color: '#555', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1f6feb',
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  secondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  secondaryButtonText: { color: '#111', fontWeight: '600', fontSize: 12 },
});
