"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSqlAlchemyModel = parseSqlAlchemyModel;
exports.parseAlembicMigration = parseAlembicMigration;
function extractType(rawType) {
    const cleaned = rawType.trim();
    const noCall = cleaned.replace(/\(.*$/, '');
    return noCall;
}
function parseSqlAlchemyModel(content) {
    const tables = [];
    const classRegex = /class\s+\w+\([^)]*\):([\s\S]*?)(?=\nclass\s+|$)/g;
    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
        const block = classMatch[1];
        const tableNameMatch = block.match(/__tablename__\s*=\s*["'](\w+)["']/);
        if (!tableNameMatch)
            continue;
        const tableName = tableNameMatch[1];
        const columns = {};
        const columnRegex = /^\s*(\w+)(?:\s*:\s*Mapped\[[^\]]+\])?\s*=\s*(?:mapped_column|Column)\(([^)\n]+)\)\s*$/gm;
        let columnMatch;
        while ((columnMatch = columnRegex.exec(block)) !== null) {
            const columnName = columnMatch[1];
            const args = columnMatch[2];
            const typeMatch = args.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)/);
            const type = extractType(typeMatch ? typeMatch[1] : 'Unknown');
            const nullable = !/nullable\s*=\s*False/.test(args);
            columns[columnName] = { type, nullable };
        }
        if (Object.keys(columns).length > 0) {
            tables.push({ name: tableName, columns });
        }
    }
    return tables;
}
function parseAlembicMigration(content) {
    const tables = [];
    const createTableBlockRegex = /op\.create_table\([\s\S]*?\n\s*\)/gm;
    let blockMatch;
    while ((blockMatch = createTableBlockRegex.exec(content)) !== null) {
        const block = blockMatch[0];
        const tableNameMatch = block.match(/op\.create_table\(\s*["'](\w+)["']/m);
        if (!tableNameMatch)
            continue;
        const tableName = tableNameMatch[1];
        const columns = {};
        const columnRegex = /sa\.Column\(\s*["'](\w+)["']\s*,\s*sa\.(\w+)\([^)]*\)([\s\S]*?)\)/gm;
        let columnMatch;
        while ((columnMatch = columnRegex.exec(block)) !== null) {
            const columnName = columnMatch[1];
            const type = columnMatch[2];
            const tail = columnMatch[3] ?? '';
            const nullable = !/nullable\s*=\s*False/.test(tail);
            columns[columnName] = { type, nullable };
        }
        if (Object.keys(columns).length > 0) {
            tables.push({ name: tableName, columns });
        }
    }
    return tables;
}
//# sourceMappingURL=python.js.map