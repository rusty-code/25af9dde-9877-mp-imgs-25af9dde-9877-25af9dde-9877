import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import {
  buildCenterOnMarkersScript,
  buildCenterOnUserScript,
  buildMapHtml,
  buildSetMarkersScript,
  buildSetUserLocationScript,
} from '../lib/mapHtml';
import { parseMapMessage, type Marker, type UserLocation } from '../types';

export interface MapProps {
  markers: Marker[];
  userLocation?: UserLocation | null;
  onLongPress: (latitude: number, longitude: number) => void;
  onMarkerPress: (id: string) => void;
}

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}


const WebView = RNWebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewHandle> }
>;

const MAP_SOURCE = { html: buildMapHtml() };


export default function Map({
  markers,
  userLocation = null,
  onLongPress,
  onMarkerPress,
}: MapProps) {
  const webViewRef = useRef<WebViewHandle | null>(null);
  const isReadyRef = useRef(false);
  const didCenterRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const inject = useCallback((script: string) => {
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const sendMarkers = useCallback(
    (list: Marker[]) => {
      inject(buildSetMarkersScript(list));
    },
    [inject]
  );

  const sendUserLocation = useCallback(
    (location: UserLocation | null) => {
      inject(buildSetUserLocationScript(location));
    },
    [inject]
  );

  const centerOnce = useCallback(
    (list: Marker[], location: UserLocation | null) => {
      if (didCenterRef.current) {
        return;
      }
      if (list.length > 0) {
        didCenterRef.current = true;
        inject(buildCenterOnMarkersScript(list));
      } else if (location) {
        didCenterRef.current = true;
        inject(buildCenterOnUserScript());
      }
    },
    [inject]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseMapMessage(event.nativeEvent.data);
      if (!message) {
        return;
      }

      switch (message.type) {
        case 'ready': {
          isReadyRef.current = true;
          setError(null);
          sendMarkers(markers);
          sendUserLocation(userLocation);
          centerOnce(markers, userLocation);
          break;
        }
        case 'longpress': {
          onLongPress(message.latitude, message.longitude);
          break;
        }
        case 'markerpress': {
          onMarkerPress(message.id);
          break;
        }
        case 'linkpress': {
          Linking.openURL(message.url).catch(() => {
            setError('Не удалось открыть ссылку.');
          });
          break;
        }
        case 'error': {
          setError(message.message || 'Не удалось загрузить карту.');
          break;
        }
        default:
          break;
      }
    },
    [
      centerOnce,
      markers,
      onLongPress,
      onMarkerPress,
      sendMarkers,
      sendUserLocation,
      userLocation,
    ]
  );

  useEffect(() => {
    if (isReadyRef.current) {
      sendMarkers(markers);
    }
  }, [markers, sendMarkers]);

  useEffect(() => {
    if (isReadyRef.current) {
      sendUserLocation(userLocation);
      centerOnce(markers, userLocation);
    }
  }, [centerOnce, markers, sendUserLocation, userLocation]);

  const retry = useCallback(() => {
    setError(null);
    isReadyRef.current = false;
    didCenterRef.current = false;
    setReloadKey((value) => value + 1);
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={MAP_SOURCE}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Загрузка карты…</Text>
          </View>
        )}
        onMessage={handleMessage}
        onError={(event) => {
          setError(
            `Не удалось загрузить карту: ${event.nativeEvent.description || 'неизвестная ошибка'}`
          );
        }}
        onHttpError={(event) => {
          setError(`Ошибка загрузки карты (HTTP ${event.nativeEvent.statusCode}).`);
        }}
        setSupportMultipleWindows={false}
        style={styles.webview}
      />

      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Ошибка карты</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e8e8' },
  webview: { flex: 1, backgroundColor: '#e8e8e8' },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8e8e8',
  },
  loadingText: { marginTop: 8, color: '#333' },
  errorOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d33',
  },
  errorTitle: { fontWeight: 'bold', color: '#b00020', marginBottom: 4 },
  errorText: { color: '#333', marginBottom: 8 },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1f6feb',
    borderRadius: 6,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
