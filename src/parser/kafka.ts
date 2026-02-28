import type { TableSchema } from '../types.js';

export function parseAvroSchema(content: string): TableSchema[] {
  try {
    const parsed = JSON.parse(content) as {
      name?: string;
      fields?: Array<{ name: string; type: string | { type: string } | string[] }>;
    };

    if (!parsed.name || !parsed.fields) return [];

    const columns: TableSchema['columns'] = {};
    for (const field of parsed.fields) {
      let type = 'unknown';
      let nullable = true;

      if (typeof field.type === 'string') {
        type = field.type;
      } else if (Array.isArray(field.type)) {
        const nonNull = field.type.find((entry) => entry !== 'null');
        type = typeof nonNull === 'string' ? nonNull : 'unknown';
        nullable = field.type.includes('null');
      } else if (field.type && typeof field.type === 'object' && 'type' in field.type) {
        type = field.type.type;
      }

      columns[field.name] = { type, nullable };
    }

    return [{ name: parsed.name, columns }];
  } catch {
    return [];
  }
}

export function parseProtoSchema(content: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const messageRegex = /message\s+(\w+)\s*\{([\s\S]*?)\}/gm;
  let messageMatch: RegExpExecArray | null;

  while ((messageMatch = messageRegex.exec(content)) !== null) {
    const name = messageMatch[1];
    const body = messageMatch[2];
    const columns: TableSchema['columns'] = {};

    const fieldRegex = /^\s*(\w+)\s+(\w+)\s*=\s*\d+\s*;/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const type = fieldMatch[1].toLowerCase();
      const field = fieldMatch[2];
      columns[field] = { type, nullable: true };
    }

    if (Object.keys(columns).length > 0) {
      tables.push({ name, columns });
    }
  }

  return tables;
}

export function parseJsonEventSchema(content: string): TableSchema[] {
  try {
    const parsed = JSON.parse(content) as {
      title?: string;
      properties?: Record<string, { type?: string }>;
      required?: string[];
    };

    if (!parsed.properties) return [];

    const tableName = parsed.title || 'EventSchema';
    const required = new Set(parsed.required ?? []);
    const columns: TableSchema['columns'] = {};

    for (const [name, prop] of Object.entries(parsed.properties)) {
      columns[name] = {
        type: prop.type ?? 'unknown',
        nullable: !required.has(name),
      };
    }

    return [{ name: tableName, columns }];
  } catch {
    return [];
  }
}
