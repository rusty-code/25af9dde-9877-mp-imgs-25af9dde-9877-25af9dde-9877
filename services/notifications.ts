import * as Notifications from 'expo-notifications';

import type { Marker } from '../types';

/** Запись об уведомлении, которое сейчас показано пользователю. */
export interface ActiveNotification {
  markerId: number;
  notificationId: string;
  timestamp: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

/** Включает показ уведомлений, пока приложение на переднем плане. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // На Android при shouldPlaySound: false не показывается всплывающий баннер,
      // поэтому звук оставляем включённым.
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Проверяет и при необходимости запрашивает разрешение на уведомления. */
export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (isAllowed(settings)) {
    return true;
  }

  if (!settings.canAskAgain) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return isAllowed(requested);
}

/** Учитывает и iOS provisional-разрешение (тихие уведомления). */
function isAllowed(settings: Notifications.NotificationPermissionsStatus): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Управляет активными уведомлениями о приближении к меткам.
 *
 * Состояние хранится в памяти: после перезапуска приложения зоны считаются
 * неактивными, поэтому при повторном входе в зону уведомление придёт снова.
 */
class NotificationManager {
  private activeNotifications = new Map<number, ActiveNotification>();
  /** Метки, для которых уведомление сейчас показывается. */
  get activeMarkerIds(): number[] {
    return Array.from(this.activeNotifications.keys());
  }

  /** Показывает уведомление о метке, если его ещё нет. */
  async showNotification(marker: Marker): Promise<void> {
    if (this.activeNotifications.has(marker.id)) {
      return;
    }

    // Резервируем место до await, чтобы параллельные вызовы не создали дубликат.
    const reserved: ActiveNotification = {
      markerId: marker.id,
      notificationId: '',
      timestamp: Date.now(),
    };
    this.activeNotifications.set(marker.id, reserved);

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Вы рядом с меткой!',
          body: `Вы находитесь рядом с точкой «${marker.title}».`,
          data: { markerId: marker.id },
        },
        trigger: null,
      });

      const current = this.activeNotifications.get(marker.id);
      if (!current || current.timestamp !== reserved.timestamp) {
        // Пока показывали уведомление, пользователь успел выйти из зоны
        // или зона была снята — сразу убираем уведомление.
        await this.cancelNotification(notificationId);
        return;
      }

      this.activeNotifications.set(marker.id, {
        markerId: marker.id,
        notificationId,
        timestamp: Date.now(),
      });
    } catch (error) {
      const current = this.activeNotifications.get(marker.id);
      if (current && current.timestamp === reserved.timestamp) {
        this.activeNotifications.delete(marker.id);
      }
      throw new Error(
        `Не удалось показать уведомление: ${toErrorMessage(error)}`
      );
    }
  }

  /** Убирает уведомление метки с экрана и из списка активных. */
  async removeNotification(markerId: number): Promise<void> {
    const notification = this.activeNotifications.get(markerId);
    if (!notification) {
      return;
    }

    try {
      await this.cancelNotification(notification.notificationId);
    } finally {
      // Удаляем запись в любом случае, иначе метка навсегда останется «внутри зоны».
      const current = this.activeNotifications.get(markerId);
      if (current && current.notificationId === notification.notificationId) {
        this.activeNotifications.delete(markerId);
      }
    }
  }

  /** Снимает показанное и отменяет запланированное уведомление. */
  private async cancelNotification(notificationId: string): Promise<void> {
    if (!notificationId) {
      return;
    }

    // Методы независимы: если один упадёт (уведомление уже закрыто пользователем),
    // второй всё равно должен выполниться.
    await Promise.allSettled([
      Notifications.dismissNotificationAsync(notificationId),
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ]).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected' && __DEV__) {
          console.error('[notifications] cancelNotification', result.reason);
        }
      }
    });
  }

  /**
   * Снимает уведомления для меток, которых больше нет,
   * и забывает зоны удалённых меток.
   */
  async syncMarkers(existingMarkerIds: Iterable<number>): Promise<void> {
    const existing = new Set(existingMarkerIds);
    const stale = this.activeMarkerIds.filter((id) => !existing.has(id));
    for (const markerId of stale) {
      await this.removeNotification(markerId);
    }
  }

  /** Снимает все уведомления и очищает состояние (при размонтировании). */
  async clear(): Promise<void> {
    const ids = this.activeMarkerIds;
    for (const markerId of ids) {
      await this.removeNotification(markerId);
    }
    this.activeNotifications.clear();
  }
}

/** Единственный экземпляр менеджера на приложение. */
export const notificationManager = new NotificationManager();
