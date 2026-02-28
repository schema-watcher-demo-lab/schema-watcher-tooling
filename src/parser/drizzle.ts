import type { TableSchema } from '../types.js';

export function parseDrizzleSchema(content: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(/(pgTable|mysqlTable|sqliteTable)\(\s*["'](\w+)["']\s*,\s*\{/);
    if (!start) continue;

    const tableName = start[2];
    const bodyLines: string[] = [];
    let depth = 1;

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      depth += opens - closes;
      if (depth <= 0) {
        i = j;
        break;
      }
      bodyLines.push(line);
    }

    const body = bodyLines.join('\n');
    const columns: TableSchema['columns'] = {};

    const columnRegex = /^(\s*)(\w+)\s*:\s*(\w+)\(/gm;
    let columnMatch: RegExpExecArray | null;

    while ((columnMatch = columnRegex.exec(body)) !== null) {
      const columnName = columnMatch[2];
      const type = columnMatch[3].toLowerCase();
      const expressionStart = columnMatch.index;
      const nextColumn = body.slice(expressionStart + 1).search(/\n\s*\w+\s*:\s*\w+\(/);
      const expressionEnd = nextColumn === -1 ? body.length : expressionStart + 1 + nextColumn;
      const expression = body.slice(expressionStart, expressionEnd);
      const nullable = !expression.includes('.notNull()');

      columns[columnName] = { type, nullable };
    }

    if (Object.keys(columns).length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}
