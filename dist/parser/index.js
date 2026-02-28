"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonEventSchema = exports.parseProtoSchema = exports.parseAvroSchema = exports.parseDrizzleSchema = exports.parseAlembicMigration = exports.parseSqlAlchemyModel = exports.parseRailsMigration = exports.parseMigration = exports.parseDbtModel = exports.parsePrisma = exports.ParserRegistry = void 0;
const prisma_js_1 = require("./prisma.js");
Object.defineProperty(exports, "parsePrisma", { enumerable: true, get: function () { return prisma_js_1.parsePrisma; } });
const dbt_js_1 = require("./dbt.js");
Object.defineProperty(exports, "parseDbtModel", { enumerable: true, get: function () { return dbt_js_1.parseDbtModel; } });
const migrations_js_1 = require("./migrations.js");
Object.defineProperty(exports, "parseMigration", { enumerable: true, get: function () { return migrations_js_1.parseMigration; } });
const rails_js_1 = require("./rails.js");
Object.defineProperty(exports, "parseRailsMigration", { enumerable: true, get: function () { return rails_js_1.parseRailsMigration; } });
const python_js_1 = require("./python.js");
Object.defineProperty(exports, "parseAlembicMigration", { enumerable: true, get: function () { return python_js_1.parseAlembicMigration; } });
Object.defineProperty(exports, "parseSqlAlchemyModel", { enumerable: true, get: function () { return python_js_1.parseSqlAlchemyModel; } });
const drizzle_js_1 = require("./drizzle.js");
Object.defineProperty(exports, "parseDrizzleSchema", { enumerable: true, get: function () { return drizzle_js_1.parseDrizzleSchema; } });
const kafka_js_1 = require("./kafka.js");
Object.defineProperty(exports, "parseAvroSchema", { enumerable: true, get: function () { return kafka_js_1.parseAvroSchema; } });
Object.defineProperty(exports, "parseProtoSchema", { enumerable: true, get: function () { return kafka_js_1.parseProtoSchema; } });
Object.defineProperty(exports, "parseJsonEventSchema", { enumerable: true, get: function () { return kafka_js_1.parseJsonEventSchema; } });
class ParserRegistry {
    parsers = new Map();
    constructor() {
        this.register('.prisma', prisma_js_1.parsePrisma);
        this.register('.yml', dbt_js_1.parseDbtModel);
        this.register('.yaml', dbt_js_1.parseDbtModel);
        this.register('.sql', migrations_js_1.parseMigration);
    }
    register(extension, parser) {
        this.parsers.set(extension, parser);
    }
    parse(content, filePath) {
        if ((filePath.endsWith('.ts') || filePath.endsWith('.js')) && filePath.includes('drizzle/')) {
            return (0, drizzle_js_1.parseDrizzleSchema)(content);
        }
        if (filePath.endsWith('.avsc')) {
            return (0, kafka_js_1.parseAvroSchema)(content);
        }
        if (filePath.endsWith('.proto')) {
            return (0, kafka_js_1.parseProtoSchema)(content);
        }
        if (filePath.endsWith('.schema.json')) {
            return (0, kafka_js_1.parseJsonEventSchema)(content);
        }
        if (filePath.endsWith('.rb') && filePath.includes('db/migrate/')) {
            return (0, rails_js_1.parseRailsMigration)(content);
        }
        if (filePath.endsWith('/models.py')) {
            return (0, python_js_1.parseSqlAlchemyModel)(content);
        }
        if (filePath.endsWith('.py') && filePath.includes('alembic/versions/')) {
            return (0, python_js_1.parseAlembicMigration)(content);
        }
        for (const [ext, parser] of this.parsers) {
            if (filePath.endsWith(ext)) {
                return parser(content, filePath);
            }
        }
        return [];
    }
}
exports.ParserRegistry = ParserRegistry;
//# sourceMappingURL=index.js.map