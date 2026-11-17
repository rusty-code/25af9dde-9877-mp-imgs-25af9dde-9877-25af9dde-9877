export function logDatabaseOperation(
  action: string,
  details?: Record<string, unknown>
): void {
  if (__DEV__) {
    console.log(`[db] ${action}`, details ?? '');
  }
}

export function toDatabaseError(action: string, cause: unknown): Error {
  if (__DEV__) {
    console.error(`[db] ${action}`, cause);
  }

  const message =
    cause instanceof Error && cause.message ? cause.message : String(cause);
  return new Error(`Ошибка БД (${action}): ${message}`);
}
