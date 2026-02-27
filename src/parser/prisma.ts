import type { TableSchema } from '../types.js';

export function parsePrisma(content: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: TableSchema['columns'] = {};
    
    const lines = body
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith('//'));

    for (const line of lines) {
      // Match: fieldName fieldType? [attributes...]
      const fieldMatch = line.match(/^(\w+)\s+([A-Za-z][A-Za-z0-9_]*)(\?)?\b/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, nullableMarker] = fieldMatch;
      columns[fieldName] = {
        type: fieldType,
        nullable: nullableMarker === '?',
      };
    }
    
    tables.push({ name: tableName, columns });
  }
  
  return tables;
}
