import type { TableSchema } from '../types.js';
import { parsePrisma } from './prisma.js';
import { parseDbtModel } from './dbt.js';
import { parseMigration } from './migrations.js';
import { parseRailsMigration } from './rails.js';
import { parseAlembicMigration, parseSqlAlchemyModel } from './python.js';

export class ParserRegistry {
  private parsers: Map<string, (content: string, filePath: string) => TableSchema[]> = new Map();

  constructor() {
    this.register('.prisma', parsePrisma);
    this.register('.yml', parseDbtModel);
    this.register('.yaml', parseDbtModel);
    this.register('.sql', parseMigration);
  }

  register(extension: string, parser: (content: string, filePath: string) => TableSchema[]) {
    this.parsers.set(extension, parser);
  }

  parse(content: string, filePath: string): TableSchema[] {
    if (filePath.endsWith('.rb') && filePath.includes('db/migrate/')) {
      return parseRailsMigration(content);
    }

    if (filePath.endsWith('/models.py')) {
      return parseSqlAlchemyModel(content);
    }

    if (filePath.endsWith('.py') && filePath.includes('alembic/versions/')) {
      return parseAlembicMigration(content);
    }

    for (const [ext, parser] of this.parsers) {
      if (filePath.endsWith(ext)) {
        return parser(content, filePath);
      }
    }
    return [];
  }
}

export { parsePrisma, parseDbtModel, parseMigration, parseRailsMigration, parseSqlAlchemyModel, parseAlembicMigration };
