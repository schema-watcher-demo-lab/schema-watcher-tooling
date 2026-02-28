"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRailsMigration = parseRailsMigration;
function normalizeRailsType(raw) {
    return raw.trim().toLowerCase();
}
function parseRailsMigration(content) {
    const tables = [];
    const createTableRegex = /create_table\s+:?(\w+)\s+do\s+\|t\|([\s\S]*?)\n\s*end/gm;
    let tableMatch;
    while ((tableMatch = createTableRegex.exec(content)) !== null) {
        const tableName = tableMatch[1];
        const body = tableMatch[2];
        const columns = {};
        const columnRegex = /^\s*t\.(\w+)\s+:?(\w+)(.*)$/gm;
        let columnMatch;
        while ((columnMatch = columnRegex.exec(body)) !== null) {
            const type = columnMatch[1];
            const columnName = columnMatch[2];
            const options = columnMatch[3] ?? '';
            if (type === 'timestamps') {
                columns.created_at = { type: 'datetime', nullable: false };
                columns.updated_at = { type: 'datetime', nullable: false };
                continue;
            }
            columns[columnName] = {
                type: normalizeRailsType(type),
                nullable: !/null:\s*false/.test(options),
            };
        }
        if (Object.keys(columns).length > 0) {
            tables.push({ name: tableName, columns });
        }
    }
    return tables;
}
//# sourceMappingURL=rails.js.map