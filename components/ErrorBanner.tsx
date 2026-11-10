import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

/** Простое сообщение об ошибке с возможностью закрыть. */
export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} style={styles.button}>
          <Text style={styles.buttonText}>Закрыть</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fbe9e9',
    borderColor: '#e0b4b4',
    borderWidth: 1,
    borderRadius: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: { flex: 1, color: '#b00020' },
  button: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: '#fff' },
  buttonText: { color: '#b00020', fontWeight: '600' },
});
