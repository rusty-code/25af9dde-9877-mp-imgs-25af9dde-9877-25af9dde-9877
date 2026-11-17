# Map and Images

React Native (Expo) MVP: карта OpenStreetMap, изображения у маркеров, локальная БД SQLite,
геолокация и локальные уведомления о приближении к меткам.

Карта — `react-native-webview` + Leaflet + тайлы OSM

## Установка и запуск

```bash
npm install
npx expo start
```

## Функциональность

- Долгое нажатие по карте добавляет маркер «Точка N»; нажатие на маркер открывает детали.
- На экране деталей: координаты, дата создания, изображения.
- «Добавить изображение» — галерея (`expo-image-picker`, несколько фото); удаление фото;
  удаление маркера вместе с изображениями (с подтверждением).
- Маркеры и изображения сохраняются в SQLite (`expo-sqlite`) и остаются после перезапуска.
- Текущее местоположение на карте: синяя точка + круг точности.
- Локальные уведомления при входе в зону метки.

## Принятые решения

- **Хранение**: `expo-sqlite` без ORM — для MVP хватает параметризованных запросов и
  явных транзакций, без лишнего слоя абстракции.
- **Карта**: HTML/Leaflet в WebView, обмен сообщениями `post` / `injectJavaScript`
  (маркеры, позиция пользователя, долгое нажатие, ссылки, ошибки).
- **Геолокация**: только foreground (`watchPositionAsync`), фоновые задачи не используются.
- **Уведомления**: синглтон `NotificationManager`, локальный показ (`trigger: null`).

## Геолокация

- `watchPositionAsync` с `accuracy: High`, `timeInterval: 5000`, `distanceInterval: 0`
  (`services/location.ts`). `High` соответствует `PRIORITY_HIGH_ACCURACY` (GPS), поэтому
  работает и на эмуляторе; при `Balanced` и `distanceInterval > 0` фиксы могли не приходить.
- Позиция дополнительно запрашивается разово (`getLastKnownPositionAsync` →
  `getCurrentPositionAsync` с таймаутом 10 с) и повторяется каждые 15 с, пока позиции нет.
- Проверяется `hasServicesEnabledAsync()`; подписка снимается при размонтировании экрана.

## Уведомления о приближении

- Расстояние — формула Хаверсина (`calculateDistance`, метры), без доп. зависимостей.
- Гистерезис: вход в зону при `distance <= 100` м, выход при `distance > 150` м
  (`ENTER_ZONE_RADIUS_M` / `EXIT_ZONE_RADIUS_M`)
- `NotificationManager` хранит `Map<markerId, ActiveNotification>`: пока метка в `Map`,
  повторное уведомление не создаётся. Слот резервируется **до** `await scheduleNotificationAsync`, поэтому параллельные проходы не дублируют уведомления;
  если за время показа пользователь вышел из зоны, уведомление сразу снимается.
- Выход из зоны или удаление метки → `dismissNotificationAsync` + `cancelScheduledNotificationAsync`,
  запись удаляется. Ошибки отмены только логируются.
- Состояние зон хранится только в памяти: после перезапуска приложения оно сбрасывается
  (по требованиям задания). При уходе с экрана карты активные уведомления снимаются.
- Разрешение проверяется при открытии карты и повторно при возврате приложения в
  foreground (`AppState`), т.к. его могли выдать или отозвать в настройках.

## Структура

```
app/
  _layout.tsx              Stack + DatabaseProvider + ErrorBoundary + notification handler
  index.tsx                экран карты
  marker/[id].tsx          экран деталей маркера
components/                Map (WebView + Leaflet), ImageList, ErrorBanner
context/DatabaseContext.tsx  подключение к SQLite, CRUD, loading/error
hooks/                     useUserLocation, useProximityNotifications
database/                  schema.ts, operations.ts, errors.ts
services/                  location.ts (Хаверсин, разрешения, watch), notifications.ts
lib/mapHtml.ts             HTML/JS карты для WebView
types.ts                   типы приложения и валидация сообщений WebView
```
