import type { TableSchema } from '../types.js';
import { parsePrisma } from './prisma.js';
import { parseDbtModel } from './dbt.js';
import { parseMigration } from './migrations.js';
import { parseRailsMigration } from './rails.js';
import { parseAlembicMigration, parseSqlAlchemyModel } from './python.js';
import { parseDrizzleSchema } from './drizzle.js';
import { parseAvroSchema, parseProtoSchema, parseJsonEventSchema } from './kafka.js';
export declare class ParserRegistry {
    private parsers;
    constructor();
    register(extension: string, parser: (content: string, filePath: string) => TableSchema[]): void;
    parse(content: string, filePath: string): TableSchema[];
}
export { parsePrisma, parseDbtModel, parseMigration, parseRailsMigration, parseSqlAlchemyModel, parseAlembicMigration, parseDrizzleSchema, parseAvroSchema, parseProtoSchema, parseJsonEventSchema, };
//# sourceMappingURL=index.d.ts.map