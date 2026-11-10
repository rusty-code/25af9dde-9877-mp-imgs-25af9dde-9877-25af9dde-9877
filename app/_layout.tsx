import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MarkersProvider } from '../context/MarkersContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MarkersProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Карта' }} />
          <Stack.Screen name="marker/[id]" options={{ title: 'Маркер' }} />
        </Stack>
      </MarkersProvider>
    </SafeAreaProvider>
  );
}

/** Экран ошибки для непредвиденных исключений в маршрутах. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Что-то пошло не так</Text>
      <Text style={styles.message}>{error.message}</Text>
      <Pressable style={styles.button} onPress={retry}>
        <Text style={styles.buttonText}>Попробовать снова</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#b00020' },
  message: { color: '#333' },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1f6feb',
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
