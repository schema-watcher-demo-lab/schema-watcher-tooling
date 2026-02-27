import type { TableSchema } from '../types.js';

export function parseDbtModel(content: string, fileName: string): TableSchema[] {
  const tables: TableSchema[] = [];
  
  const nameMatch = fileName.match(/\/models\/(\w+)\./);
  const tableName = nameMatch ? nameMatch[1] : 'unknown';
  
  const columns: TableSchema['columns'] = {};
  
  const columnRegex = /^\s+(\w+):\s*(\w+)/gm;
  let match;
  while ((match = columnRegex.exec(content)) !== null) {
    const [, colName, colType] = match;
    columns[colName] = { type: colType, nullable: true };
  }
  
  if (Object.keys(columns).length > 0) {
    tables.push({ name: tableName, columns });
  }
  
  return tables;
}
