import type { SchemaChange } from "./types.js";

const BREAKING_TYPES = new Set([
  "TABLE_REMOVED",
  "COLUMN_REMOVED",
  "COLUMN_TYPE_CHANGED",
  "COLUMN_NULLABLE_CHANGED",
  "COLUMN_DEFAULT_CHANGED",
  "COLUMN_RENAMED",
]);

export function countBreakingChanges(changes: SchemaChange[]): number {
  return changes.filter((change) => BREAKING_TYPES.has(change.changeType)).length;
}
