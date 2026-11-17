import { randomUUID } from 'node:crypto';
import type { SqlLogEntry } from '../types/clinic.js';

const MAX_LOGS = 50;
const logs: SqlLogEntry[] = [];

export function addSqlLog(
  entry: Omit<SqlLogEntry, 'id' | 'timestamp'>
): SqlLogEntry {
  const fullEntry: SqlLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(fullEntry);
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }
  return fullEntry;
}

export function getSqlLogs(): SqlLogEntry[] {
  return [...logs];
}

export function clearSqlLogs(): void {
  logs.length = 0;
}
