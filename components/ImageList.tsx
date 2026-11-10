import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { MarkerImage } from '../types';

export interface ImageListProps {
  images: MarkerImage[];
  onRemove: (imageId: string) => void;
}

const COLUMNS = 3;
const GAP = 8;

/** Сетка изображений маркера с кнопкой удаления. */
export default function ImageList({ images, onRemove }: ImageListProps) {
  const { width } = useWindowDimensions();
  const itemSize = Math.max(80, Math.floor((width - GAP * (COLUMNS + 1)) / COLUMNS));

  if (images.length === 0) {
    return <Text style={styles.emptyText}>У этого маркера пока нет изображений.</Text>;
  }

  return (
    <FlatList
      data={images}
      numColumns={COLUMNS}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.item,
            {
              width: itemSize,
              marginRight: (index + 1) % COLUMNS === 0 ? 0 : GAP,
            },
          ]}
        >
          <Image source={{ uri: item.uri }} style={{ width: itemSize, height: itemSize }} />
          <Pressable style={styles.removeButton} onPress={() => onRemove(item.id)}>
            <Text style={styles.removeButtonText}>Удалить</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  emptyText: { color: '#666', paddingVertical: 8 },
  row: {},
  item: { marginBottom: GAP },
  removeButton: {
    marginTop: 4,
    paddingVertical: 4,
    backgroundColor: '#fbe9e9',
    borderRadius: 4,
    alignItems: 'center',
  },
  removeButtonText: { color: '#b00020', fontSize: 12 },
});
