import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ErrorBanner from '../../components/ErrorBanner';
import ImageList from '../../components/ImageList';
import { createMarkerImage, useMarkers } from '../../context/MarkersContext';
import { formatCoordinates } from '../../types';


function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}


function goBackToMap() {
  try {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  } catch {
    router.replace('/');
  }
}

export default function MarkerDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const markerId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { getMarker, addImages, removeImage, removeMarker } = useMarkers();
  const marker = markerId ? getMarker(markerId) : undefined;

  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pickImages = useCallback(async () => {
    if (!markerId) {
      setError('Не удалось определить маркер.');
      return;
    }

    setIsPicking(true);
    setError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          'Нет доступа к галерее. Разрешите доступ к фото в настройках устройства и попробуйте снова.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.7,
      });

      if (result.canceled) {
        return;
      }

      const assets = result.assets ?? [];
      if (assets.length === 0) {
        setError('Изображения не выбраны.');
        return;
      }

      const images = assets
        .filter((asset) => typeof asset.uri === 'string' && asset.uri.length > 0)
        .map((asset) =>
          createMarkerImage({ uri: asset.uri, width: asset.width, height: asset.height })
        );

      if (images.length === 0) {
        setError('Не удалось получить выбранные изображения.');
        return;
      }

      addImages(markerId, images);
    } catch (exception) {
      setError(`Не удалось выбрать изображения: ${toErrorMessage(exception)}`);
    } finally {
      setIsPicking(false);
    }
  }, [addImages, markerId]);

  const handleRemoveImage = useCallback(
    (imageId: string) => {
      if (!markerId) {
        return;
      }
      try {
        removeImage(markerId, imageId);
      } catch (exception) {
        setError(`Не удалось удалить изображение: ${toErrorMessage(exception)}`);
      }
    },
    [markerId, removeImage]
  );

  const deleteMarker = useCallback(() => {
    if (!markerId) {
      setError('Не удалось определить маркер.');
      return;
    }

    const remove = () => {
      try {
        setIsDeleting(true);
        removeMarker(markerId);
      } catch (exception) {
        setIsDeleting(false);
        setError(`Не удалось удалить маркер: ${toErrorMessage(exception)}`);
        return;
      }
      goBackToMap();
    };

    try {
      Alert.alert('Удалить маркер?', 'Маркер и все его изображения будут удалены.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: remove },
      ]);
    } catch {
      // Если диалог недоступен, удаляем сразу.
      remove();
    }
  }, [markerId, removeMarker]);

  if (!marker) {
    if (isDeleting) {
      // Маркер уже удалён — экран закроется в процессе навигации назад.
      return (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Маркер удалён.</Text>
        </View>
      );
    }
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Маркер не найден</Text>
        <Text style={styles.notFoundText}>
          Возможно, маркер был удалён или ссылка на него некорректна.
        </Text>
        <Pressable style={styles.button} onPress={goBackToMap}>
          <Text style={styles.buttonText}>Вернуться к карте</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <View style={styles.section}>
        <Text style={styles.title}>{marker.title}</Text>
        <Text style={styles.coords}>
          Координаты: {formatCoordinates(marker.latitude, marker.longitude)}
        </Text>
        <Text style={styles.meta}>
          Создан: {new Date(marker.createdAt).toLocaleString('ru-RU')}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.subtitle}>Изображения ({marker.images.length})</Text>
          <Pressable
            style={[styles.button, isPicking && styles.buttonDisabled]}
            onPress={pickImages}
            disabled={isPicking}
          >
            {isPicking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Добавить изображение</Text>
            )}
          </Pressable>
        </View>

        <ImageList images={marker.images} onRemove={handleRemoveImage} />
      </View>

      <Pressable style={[styles.button, styles.secondaryButton]} onPress={goBackToMap}>
        <Text style={styles.secondaryButtonText}>Вернуться к карте</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.dangerButton]} onPress={deleteMarker}>
        <Text style={styles.dangerButtonText}>Удалить маркер</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 16, paddingBottom: 32 },
  section: { gap: 6 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  coords: { color: '#333' },
  meta: { color: '#666', fontSize: 12 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { backgroundColor: '#eee', alignSelf: 'flex-start' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
  dangerButton: { backgroundColor: '#fbe9e9', alignSelf: 'flex-start' },
  dangerButtonText: { color: '#b00020', fontWeight: '600' },
  notFound: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  notFoundTitle: { fontSize: 18, fontWeight: 'bold', color: '#b00020' },
  notFoundText: { color: '#333' },
});
