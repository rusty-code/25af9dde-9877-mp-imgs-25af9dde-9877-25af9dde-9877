import type { SQLiteDatabase } from 'expo-sqlite';

import type { Marker, MarkerImage } from '../types';
import { logDatabaseOperation, toDatabaseError } from './errors';

interface MarkerRow {
  id: number;
  latitude: number;
  longitude: number;
  created_at: string | number | null;
}

interface MarkerImageRow {
  id: number;
  marker_id: number;
  uri: string;
  created_at: string | number | null;
}

function parseSqliteDate(value: string | number | null): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Date.now();
  }

  if (typeof value === 'string' && value.length > 0) {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
    const parsed = Date.parse(hasTimezone ? normalized : `${normalized}Z`);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function mapMarkerRow(row: MarkerRow): Marker {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    title: `Точка ${row.id}`,
    createdAt: parseSqliteDate(row.created_at),
  };
}

function mapImageRow(row: MarkerImageRow): MarkerImage {
  return {
    id: row.id,
    markerId: row.marker_id,
    uri: row.uri,
    createdAt: parseSqliteDate(row.created_at),
  };
}

export async function insertMarker(
  db: SQLiteDatabase,
  latitude: number,
  longitude: number
): Promise<number> {
  try {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new Error('Некорректные координаты маркера.');
    }

    const result = await db.runAsync(
      'INSERT INTO markers (latitude, longitude) VALUES (?, ?);',
      latitude,
      longitude
    );
    logDatabaseOperation('insertMarker', {
      id: result.lastInsertRowId,
      latitude,
      longitude,
    });
    return result.lastInsertRowId;
  } catch (error) {
    throw toDatabaseError('addMarker', error);
  }
}

export async function selectMarkers(db: SQLiteDatabase): Promise<Marker[]> {
  try {
    const rows = await db.getAllAsync<MarkerRow>(
      'SELECT id, latitude, longitude, created_at FROM markers ORDER BY id ASC;'
    );
    logDatabaseOperation('selectMarkers', { count: rows.length });
    return rows.map(mapMarkerRow);
  } catch (error) {
    throw toDatabaseError('getMarkers', error);
  }
}

export async function deleteMarkerCascade(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM marker_images WHERE marker_id = ?;', id);
      const result = await db.runAsync('DELETE FROM markers WHERE id = ?;', id);

      if (result.changes === 0) {
        throw new Error('Маркер не найден.');
      }
    });
    logDatabaseOperation('deleteMarkerCascade', { id });
  } catch (error) {
    throw toDatabaseError('deleteMarker', error);
  }
}

export async function insertImage(
  db: SQLiteDatabase,
  markerId: number,
  uri: string
): Promise<number> {
  try {
    const normalizedUri = uri.trim();
    if (normalizedUri.length === 0) {
      throw new Error('Пустой URI изображения.');
    }

    const marker = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM markers WHERE id = ?;',
      markerId
    );
    if (!marker) {
      throw new Error('Маркер не найден.');
    }

    const result = await db.runAsync(
      'INSERT INTO marker_images (marker_id, uri) VALUES (?, ?);',
      markerId,
      normalizedUri
    );
    logDatabaseOperation('insertImage', {
      id: result.lastInsertRowId,
      markerId,
    });
    return result.lastInsertRowId;
  } catch (error) {
    throw toDatabaseError('addImage', error);
  }
}

export async function deleteImageById(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  try {
    const result = await db.runAsync(
      'DELETE FROM marker_images WHERE id = ?;',
      id
    );
    if (result.changes === 0) {
      throw new Error('Изображение не найдено.');
    }
    logDatabaseOperation('deleteImageById', { id });
  } catch (error) {
    throw toDatabaseError('deleteImage', error);
  }
}

export async function selectImagesByMarker(
  db: SQLiteDatabase,
  markerId: number
): Promise<MarkerImage[]> {
  try {
    const rows = await db.getAllAsync<MarkerImageRow>(
      `SELECT id, marker_id, uri, created_at
         FROM marker_images
        WHERE marker_id = ?
        ORDER BY id ASC;`,
      markerId
    );
    logDatabaseOperation('selectImagesByMarker', {
      markerId,
      count: rows.length,
    });
    return rows.map(mapImageRow);
  } catch (error) {
    throw toDatabaseError('getMarkerImages', error);
  }
}
