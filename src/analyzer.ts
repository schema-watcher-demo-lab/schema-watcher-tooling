import type { TableSchema, SchemaChange } from './types.js';

export function analyzeChanges(oldSchema: TableSchema[], newSchema: TableSchema[]): SchemaChange[] {
  const changes: SchemaChange[] = [];
  
  const oldTables = new Map(oldSchema.map(t => [t.name, t]));
  const newTables = new Map(newSchema.map(t => [t.name, t]));
  
  for (const [name, table] of newTables) {
    const oldTable = oldTables.get(name);
    
    if (!oldTable) {
      changes.push({ table: name, changeType: 'TABLE_ADDED' });
      continue;
    }
    
    for (const [colName, col] of Object.entries(table.columns)) {
      const oldCol = oldTable.columns[colName];
      
      if (!oldCol) {
        changes.push({ table: name, changeType: 'COLUMN_ADDED', column: colName, newType: col.type });
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
          oldType: oldCol.type,
          newType: col.type,
        });
      }
    }
    
    for (const colName of Object.keys(oldTable.columns)) {
      if (!table.columns[colName]) {
        changes.push({ table: name, changeType: 'COLUMN_REMOVED', column: colName, oldType: oldTable.columns[colName].type });
      }
    }
  }
  
  for (const [name] of oldTables) {
    if (!newTables.has(name)) {
      changes.push({ table: name, changeType: 'TABLE_REMOVED' });
    }
  }
  
  return changes;
}
