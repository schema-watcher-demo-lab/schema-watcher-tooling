import type { TableSchema } from '../types.js';

export function parseMigration(content: string): TableSchema[] {
  const tables: TableSchema[] = [];
  
  const createTableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^;]+)\);?/gi);
  
  for (const match of createTableMatches) {
    const tableName = match[1];
    const columnsBody = match[2];
    const columns: TableSchema['columns'] = {};
    
    const columnMatches = columnsBody.matchAll(/^\s*[`"']?(\w+)[`"']?\s+([A-Z][A-Z0-9_()]+)(?:\s+NOT\s+NULL)?(?:\s+DEFAULT\s+([^,\s]+))?/gim);
    
    for (const colMatch of columnMatches) {
      const [, colName, colType] = colMatch;
      const isNotNull = colMatch[0].toLowerCase().includes('not null');
      columns[colName] = {
        type: colType,
        nullable: !isNotNull,
      };
    }
    
    if (Object.keys(columns).length > 0) {
      tables.push({ name: tableName, columns });
    }
  }
  
  return tables;
}
