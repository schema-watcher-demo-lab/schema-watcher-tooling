"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDbtModel = parseDbtModel;
function parseDbtModel(content, fileName) {
    const tables = [];
    const nameMatch = fileName.match(/\/models\/(\w+)\./);
    const tableName = nameMatch ? nameMatch[1] : 'unknown';
    const columns = {};
    const columnRegex = /^\s+(\w+):\s*(\w+)/gm;
    let match;
    while ((match = columnRegex.exec(content)) !== null) {
        const [, colName, colType] = match;
        columns[colName] = { type: colType, nullable: true };
    }
    if (Object.keys(columns).length > 0) {
        tables.push({ name: tableName, columns });
    }
    return tables;
}
//# sourceMappingURL=dbt.js.map