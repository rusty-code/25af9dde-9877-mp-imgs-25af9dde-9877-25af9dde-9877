import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { logDatabaseOperation, toDatabaseError } from './errors';

/** Имя файла локальной базы данных. */
export const DATABASE_NAME = 'markers.db';

/** Текущая версия схемы. */
export const DATABASE_VERSION = 1;

const CREATE_MARKERS_TABLE = `
  CREATE TABLE IF NOT EXISTS markers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const CREATE_MARKER_IMAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS marker_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marker_id INTEGER NOT NULL,
    uri TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (marker_id) REFERENCES markers (id) ON DELETE CASCADE
  );
`;

const CREATE_MARKER_IMAGES_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_marker_images_marker_id
    ON marker_images (marker_id);
`;

/**
 * Открывает БД, включает внешние ключи и применяет миграции схемы.
 * Для текущей версии существует только миграция 0 -> 1.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  let database: SQLiteDatabase | null = null;

  try {
    const openedDatabase = await openDatabaseAsync(DATABASE_NAME);
    database = openedDatabase;

    // PRAGMA foreign_keys действует в рамках соединения, поэтому включаем его
    // при каждом открытии БД. Без этого ON DELETE CASCADE не сработает.
    await openedDatabase.execAsync('PRAGMA foreign_keys = ON;');

    const versionRow = await openedDatabase.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version;'
    );
    const currentVersion = versionRow?.user_version ?? 0;

    if (currentVersion > DATABASE_VERSION) {
      throw new Error(
        `Версия базы данных ${currentVersion} новее поддерживаемой ${DATABASE_VERSION}.`
      );
    }

    if (currentVersion < DATABASE_VERSION) {
      logDatabaseOperation('migrate', {
        from: currentVersion,
        to: DATABASE_VERSION,
      });

      await openedDatabase.withTransactionAsync(async () => {
        if (currentVersion < 1) {
          await openedDatabase.execAsync(CREATE_MARKERS_TABLE);
          await openedDatabase.execAsync(CREATE_MARKER_IMAGES_TABLE);
          await openedDatabase.execAsync(CREATE_MARKER_IMAGES_INDEX);
        }

        await openedDatabase.execAsync(
          `PRAGMA user_version = ${DATABASE_VERSION};`
        );
      });
    }

    logDatabaseOperation('initDatabase', { version: DATABASE_VERSION });
    return openedDatabase;
  } catch (error) {
    if (database) {
      try {
        await database.closeAsync();
      } catch (closeError) {
        if (__DEV__) {
          console.error('[db] closeAfterInitError', closeError);
        }
      }
    }
    throw toDatabaseError('initDatabase', error);
  }
}
