import type { TableSchema } from '../types.js';

export function parsePrisma(content: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: TableSchema['columns'] = {};
    
    const fieldRegex = /(\w+)\s+(\w+)(\?)?(\s+@default\([^)]+\))?/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const [, fieldName, fieldType] = fieldMatch;
      columns[fieldName] = {
        type: fieldType,
        nullable: fieldMatch[3] === '?',
      };
    }
    
    tables.push({ name: tableName, columns });
  }
  
  return tables;
}
