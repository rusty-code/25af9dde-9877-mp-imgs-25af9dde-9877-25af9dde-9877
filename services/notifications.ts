import * as Notifications from 'expo-notifications';

import type { Marker } from '../types';

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

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

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

function isAllowed(settings: Notifications.NotificationPermissionsStatus): boolean {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

class NotificationManager {
  private activeNotifications = new Map<number, ActiveNotification>();
  get activeMarkerIds(): number[] {
    return Array.from(this.activeNotifications.keys());
  }

  async showNotification(marker: Marker): Promise<void> {
    if (this.activeNotifications.has(marker.id)) {
      return;
    }

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

  async removeNotification(markerId: number): Promise<void> {
    const notification = this.activeNotifications.get(markerId);
    if (!notification) {
      return;
    }

    try {
      await this.cancelNotification(notification.notificationId);
    } finally {
      const current = this.activeNotifications.get(markerId);
      if (current && current.notificationId === notification.notificationId) {
        this.activeNotifications.delete(markerId);
      }
    }
  }

  private async cancelNotification(notificationId: string): Promise<void> {
    if (!notificationId) {
      return;
    }

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

  async syncMarkers(existingMarkerIds: Iterable<number>): Promise<void> {
    const existing = new Set(existingMarkerIds);
    const stale = this.activeMarkerIds.filter((id) => !existing.has(id));
    for (const markerId of stale) {
      await this.removeNotification(markerId);
    }
  }

  async clear(): Promise<void> {
    const ids = this.activeMarkerIds;
    for (const markerId of ids) {
      await this.removeNotification(markerId);
    }
    this.activeNotifications.clear();
  }
}

export const notificationManager = new NotificationManager();
