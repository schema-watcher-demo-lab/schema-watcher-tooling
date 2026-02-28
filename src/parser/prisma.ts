import type { TableSchema } from '../types.js';

function extractModelBlocks(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  const modelStartRegex = /model\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = modelStartRegex.exec(content)) !== null) {
    const name = match[1];
    const openingBraceIndex = modelStartRegex.lastIndex - 1;
    let depth = 1;
    let i = openingBraceIndex + 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    while (i < content.length && depth > 0) {
      const char = content[i];
      if (escaped) {
        escaped = false;
        i += 1;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        i += 1;
        continue;
      }
      if (!inSingleQuote && char === '"') {
        inDoubleQuote = !inDoubleQuote;
        i += 1;
        continue;
      }
      if (!inDoubleQuote && char === "'") {
        inSingleQuote = !inSingleQuote;
        i += 1;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
      }
      i += 1;
    }

    if (depth === 0) {
      const body = content.slice(openingBraceIndex + 1, i - 1);
      models.push({ name, body });
      modelStartRegex.lastIndex = i;
    }
  }

  return models;
}

export function parsePrisma(content: string): TableSchema[] {
  const tables: TableSchema[] = [];

  for (const { name: tableName, body } of extractModelBlocks(content)) {
    const columns: TableSchema['columns'] = {};

    const lines = body
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith('//'));

    for (const line of lines) {
      if (line.startsWith('@@')) continue;

      // Match: fieldName fieldType? [attributes...]
      const fieldMatch = line.match(/^(\w+)\s+([A-Za-z][A-Za-z0-9_]*)(\?|\[\])?(?=\s|$)/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, marker] = fieldMatch;
      if (marker === '[]' || line.includes('@relation')) {
        continue;
      }

      columns[fieldName] = {
        type: fieldType,
        nullable: marker === '?',
      };
    }

    tables.push({ name: tableName, columns });
  }

  return tables;
}
