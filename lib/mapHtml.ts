import type { MapMarker } from '../types';

/** Начальный центр карты (Москва) и зум. */
export const DEFAULT_CENTER = { latitude: 55.751244, longitude: 37.618423 };
export const DEFAULT_ZOOM = 12;

/**
 * HTML-документ с Leaflet и тайлами OpenStreetMap.
 *
 * Внутри WebView доступны:
 * - `window.__setMarkers(markers)` — обновление маркеров из React Native;
 * - `window.ReactNativeWebView.postMessage(...)` — события в React Native.
 */
export function buildMapHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
        padding: 0;
        background: #e8e8e8;
      }
      .leaflet-container {
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      (function () {
        function post(message) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        function fail(message) {
          post({ type: 'error', message: String(message || 'Неизвестная ошибка карты') });
        }

        window.onerror = function (message) {
          fail(message);
        };

        if (typeof L === 'undefined') {
          fail('Не удалось загрузить библиотеку карты (Leaflet). Проверьте подключение к интернету.');
          return;
        }

        var map = L.map('map', {
          center: [${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}],
          zoom: ${DEFAULT_ZOOM},
          zoomControl: false,
          attributionControl: true,
        });

        var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });

        var tileErrorReported = false;
        tiles.on('tileerror', function () {
          if (tileErrorReported) {
            return;
          }
          tileErrorReported = true;
          fail('Не удалось загрузить тайлы карты. Проверьте подключение к интернету.');
        });

        tiles.addTo(map);

        var markersLayer = L.layerGroup().addTo(map);
        var markersById = {};

        function clearMarkers() {
          markersLayer.clearLayers();
          markersById = {};
        }

        function renderMarkers(markers) {
          clearMarkers();
          (markers || []).forEach(function (item) {
            if (
              !item ||
              typeof item.id !== 'string' ||
              typeof item.latitude !== 'number' ||
              typeof item.longitude !== 'number'
            ) {
              return;
            }
            var marker = L.marker([item.latitude, item.longitude], {
              title: typeof item.title === 'string' ? item.title : '',
            });
            marker.on('click', function () {
              post({ type: 'markerpress', id: item.id });
            });
            marker.addTo(markersLayer);
            markersById[item.id] = marker;
          });
        }

        window.__setMarkers = function (markers) {
          try {
            renderMarkers(markers);
          } catch (error) {
            fail(error && error.message ? error.message : error);
          }
        };

        var lastSyntheticLongPressAt = 0;

        function isMarkerTarget(target) {
          return !!target && typeof target.closest === 'function' && !!target.closest('.leaflet-marker-icon');
        }

        // Долгое нажатие по карте: на тач-устройствах Leaflet генерирует 'contextmenu'.
        map.on('contextmenu', function (event) {
          if (isMarkerTarget(event.originalEvent && event.originalEvent.target)) {
            return;
          }
          // Не дублируем событие, если его уже отправил собственный обработчик долгого нажатия.
          if (Date.now() - lastSyntheticLongPressAt < 1000) {
            return;
          }
          post({
            type: 'longpress',
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });

        // Собственный обработчик долгого нажатия (надёжно работает на Android и iOS).
        var pressTimer = null;
        var pressStart = null;
        var pressStartLatLng = null;

        function cancelPress() {
          if (pressTimer !== null) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          pressStart = null;
          pressStartLatLng = null;
        }

        var container = map.getContainer();

        container.addEventListener(
          'touchstart',
          function (event) {
            if (event.touches.length !== 1 || isMarkerTarget(event.target)) {
              return;
            }
            var touch = event.touches[0];
            var rect = container.getBoundingClientRect();
            cancelPress();
            pressStart = { x: touch.clientX, y: touch.clientY };
            pressStartLatLng = map.containerPointToLatLng(
              L.point(touch.clientX - rect.left, touch.clientY - rect.top)
            );
            pressTimer = setTimeout(function () {
              pressTimer = null;
              if (!pressStartLatLng) {
                return;
              }
              lastSyntheticLongPressAt = Date.now();
              post({
                type: 'longpress',
                latitude: pressStartLatLng.lat,
                longitude: pressStartLatLng.lng,
              });
            }, 600);
          },
          { passive: true }
        );

        container.addEventListener(
          'touchmove',
          function (event) {
            if (!pressStart) {
              return;
            }
            var touch = event.touches[0];
            if (!touch) {
              return;
            }
            var dx = Math.abs(touch.clientX - pressStart.x);
            var dy = Math.abs(touch.clientY - pressStart.y);
            // Если палец сдвинулся — это панорамирование, а не долгое нажатие.
            if (dx > 10 || dy > 10) {
              cancelPress();
            }
          },
          { passive: true }
        );

        container.addEventListener('touchend', cancelPress, { passive: true });
        container.addEventListener('touchcancel', cancelPress, { passive: true });

        // Ссылки в атрибуции открываем во внешнем браузере, чтобы не терять карту.
        document.addEventListener('click', function (event) {
          var target = event.target;
          var anchor = target && typeof target.closest === 'function' ? target.closest('a') : null;
          if (anchor && anchor.href) {
            event.preventDefault();
            post({ type: 'linkpress', url: anchor.href });
          }
        });

        // Центрируем карту на существующих маркерах при первой отрисовке.
        window.__centerOnMarkers = function (markers) {
          if (!markers || !markers.length) {
            return;
          }
          var bounds = L.latLngBounds(
            markers.map(function (item) {
              return [item.latitude, item.longitude];
            })
          );
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        };

        post({ type: 'ready' });
      })();
    </script>
  </body>
</html>`;
}

/** Скрипт для передачи маркеров из React Native в WebView. */
export function buildSetMarkersScript(markers: MapMarker[]): string {
  const payload = JSON.stringify(
    markers.map(({ id, latitude, longitude, title }) => ({ id, latitude, longitude, title }))
  );
  return `window.__setMarkers && window.__setMarkers(${payload}); true;`;
}

/** Скрипт для первичного центрирования карты по маркерам. */
export function buildCenterOnMarkersScript(markers: MapMarker[]): string {
  const payload = JSON.stringify(
    markers.map(({ latitude, longitude }) => ({ latitude, longitude }))
  );
  return `window.__centerOnMarkers && window.__centerOnMarkers(${payload}); true;`;
}
