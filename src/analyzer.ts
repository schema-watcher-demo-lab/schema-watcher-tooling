import type { TableSchema, SchemaChange } from './types.js';

function columnSignature(column: TableSchema['columns'][string]): string {
  return `${column.type}::${String(column.nullable)}::${column.default ?? ''}`;
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

export function analyzeChanges(oldSchema: TableSchema[], newSchema: TableSchema[]): SchemaChange[] {
  const changes: SchemaChange[] = [];
  
  const oldTables = new Map(oldSchema.map(t => [t.name, t]));
  const newTables = new Map(newSchema.map(t => [t.name, t]));
  
  for (const [name, table] of newTables) {
    const oldTable = oldTables.get(name);
    
    if (!oldTable) {
      changes.push({ table: name, changeType: 'TABLE_ADDED' });
      for (const [colName, col] of Object.entries(table.columns)) {
        changes.push({ table: name, changeType: 'COLUMN_ADDED', column: colName, newType: col.type });
      }
      continue;
    }
    
    const addedColumns: Array<{ name: string; col: TableSchema['columns'][string] }> = [];
    const removedColumns: Array<{ name: string; col: TableSchema['columns'][string] }> = [];

    for (const [colName, col] of Object.entries(table.columns)) {
      const oldCol = oldTable.columns[colName];
      
      if (!oldCol) {
        addedColumns.push({ name: colName, col });
      } else if (oldCol.type !== col.type) {
        changes.push({ 
          table: name, 
          changeType: 'COLUMN_TYPE_CHANGED', 
          column: colName, 
          oldType: oldCol.type, 
          newType: col.type 
        });
      } else if (oldCol.nullable !== col.nullable) {
        changes.push({ 
          table: name, 
          changeType: 'COLUMN_NULLABLE_CHANGED', 
          column: colName,
          oldNullable: oldCol.nullable,
          newNullable: col.nullable,
        });
      } else if (oldCol.default !== col.default) {
        changes.push({
          table: name,
          changeType: 'COLUMN_DEFAULT_CHANGED',
          column: colName,
          oldDefault: oldCol.default,
          newDefault: col.default,
        });
      }
    }
    
    for (const colName of Object.keys(oldTable.columns)) {
      if (!table.columns[colName]) {
        removedColumns.push({ name: colName, col: oldTable.columns[colName] });
      }
    }

    const usedAdded = new Set<string>();
    const usedRemoved = new Set<string>();
    const candidatePairs = removedColumns
      .flatMap((removed) =>
        addedColumns
          .filter((added) => columnSignature(added.col) === columnSignature(removed.col))
          .map((added) => ({
            removed,
            added,
            distance: levenshteinDistance(removed.name, added.name),
          }))
      )
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        const removedCompare = a.removed.name.localeCompare(b.removed.name);
        if (removedCompare !== 0) return removedCompare;
        return a.added.name.localeCompare(b.added.name);
      });

    for (const pair of candidatePairs) {
      if (usedRemoved.has(pair.removed.name) || usedAdded.has(pair.added.name)) continue;
      usedRemoved.add(pair.removed.name);
      usedAdded.add(pair.added.name);
      changes.push({
        table: name,
        changeType: 'COLUMN_RENAMED',
        column: pair.added.name,
        oldColumn: pair.removed.name,
        newColumn: pair.added.name,
        oldType: pair.removed.col.type,
        newType: pair.added.col.type,
      });
    }

    for (const added of addedColumns) {
      if (usedAdded.has(added.name)) continue;
      changes.push({
        table: name,
        changeType: 'COLUMN_ADDED',
        column: added.name,
        newType: added.col.type,
      });
    }
    for (const removed of removedColumns) {
      if (usedRemoved.has(removed.name)) continue;
      changes.push({
        table: name,
        changeType: 'COLUMN_REMOVED',
        column: removed.name,
        oldType: removed.col.type,
      });
    }
  }
  
  for (const [name, table] of oldTables) {
    if (!newTables.has(name)) {
      changes.push({ table: name, changeType: 'TABLE_REMOVED' });
      for (const [colName, col] of Object.entries(table.columns)) {
        changes.push({
          table: name,
          changeType: 'COLUMN_REMOVED',
          column: colName,
          oldType: col.type,
        });
      }
    }
  }
  
  return changes;
}
