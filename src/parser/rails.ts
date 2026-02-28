import type { TableSchema } from '../types.js';

function normalizeRailsType(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseRailsMigration(content: string): TableSchema[] {
  const tablesByName = new Map<string, TableSchema['columns']>();

  function upsertColumn(tableName: string, columnName: string, column: TableSchema['columns'][string]) {
    const existing = tablesByName.get(tableName) ?? {};
    existing[columnName] = column;
    tablesByName.set(tableName, existing);
  }

  const createTableRegex = /create_table\s+:?(\w+)\s+do\s+\|t\|([\s\S]*?)\n\s*end/gm;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = createTableRegex.exec(content)) !== null) {
    const tableName = tableMatch[1];
    const body = tableMatch[2];
    const columns: TableSchema['columns'] = {};

    const columnRegex = /^\s*t\.(\w+)\s+:?(\w+)(.*)$/gm;
    let columnMatch: RegExpExecArray | null;

    while ((columnMatch = columnRegex.exec(body)) !== null) {
      const type = columnMatch[1];
      const columnName = columnMatch[2];
      const options = columnMatch[3] ?? '';

      if (type === 'timestamps') {
        upsertColumn(tableName, 'created_at', { type: 'datetime', nullable: false });
        upsertColumn(tableName, 'updated_at', { type: 'datetime', nullable: false });
        continue;
      }

      columns[columnName] = {
        type: normalizeRailsType(type),
        nullable: !/null:\s*false/.test(options),
      };
    }

    if (Object.keys(columns).length > 0) {
      for (const [columnName, column] of Object.entries(columns)) {
        upsertColumn(tableName, columnName, column);
      }
    }
  }

  const addColumnRegex = /add_column\s+:?(\w+)\s*,\s*:?(["']?\w+["']?)\s*,\s*:?(\w+)(.*)$/gm;
  let addColumnMatch: RegExpExecArray | null;
  while ((addColumnMatch = addColumnRegex.exec(content)) !== null) {
    const tableName = addColumnMatch[1];
    const columnName = addColumnMatch[2].replace(/^['"]|['"]$/g, '');
    const type = normalizeRailsType(addColumnMatch[3]);
    const options = addColumnMatch[4] ?? '';
    upsertColumn(tableName, columnName, {
      type,
      nullable: !/null:\s*false/.test(options),
    });
  }

  return Array.from(tablesByName.entries()).map(([name, columns]) => ({ name, columns }));
}
