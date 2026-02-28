"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeChanges = analyzeChanges;
function analyzeChanges(oldSchema, newSchema) {
    const changes = [];
    const oldTables = new Map(oldSchema.map(t => [t.name, t]));
    const newTables = new Map(newSchema.map(t => [t.name, t]));
    for (const [name, table] of newTables) {
        const oldTable = oldTables.get(name);
        if (!oldTable) {
            changes.push({ table: name, changeType: 'TABLE_ADDED' });
            for (const [colName, col] of Object.entries(table.columns)) {
                changes.push({ table: name, changeType: 'COLUMN_ADDED', column: colName, newType: col.type });
            }
            continue;
        }
        const addedColumns = [];
        const removedColumns = [];
        for (const [colName, col] of Object.entries(table.columns)) {
            const oldCol = oldTable.columns[colName];
            if (!oldCol) {
                addedColumns.push({ name: colName, col });
            }
            else if (oldCol.type !== col.type) {
                changes.push({
                    table: name,
                    changeType: 'COLUMN_TYPE_CHANGED',
                    column: colName,
                    oldType: oldCol.type,
                    newType: col.type
                });
            }
            else if (oldCol.nullable !== col.nullable) {
                changes.push({
                    table: name,
                    changeType: 'COLUMN_NULLABLE_CHANGED',
                    column: colName,
                    oldNullable: oldCol.nullable,
                    newNullable: col.nullable,
                });
            }
            else if (oldCol.default !== col.default) {
                changes.push({
                    table: name,
                    changeType: 'COLUMN_DEFAULT_CHANGED',
                    column: colName,
                    oldDefault: oldCol.default,
                    newDefault: col.default,
                });
            }
        }
        for (const colName of Object.keys(oldTable.columns)) {
            if (!table.columns[colName]) {
                removedColumns.push({ name: colName, col: oldTable.columns[colName] });
            }
        }
        const usedAdded = new Set();
        const usedRemoved = new Set();
        for (const removed of removedColumns) {
            const renamedTo = addedColumns.find((added) => !usedAdded.has(added.name) &&
                added.col.type === removed.col.type &&
                added.col.nullable === removed.col.nullable &&
                added.col.default === removed.col.default);
            if (!renamedTo)
                continue;
            usedRemoved.add(removed.name);
            usedAdded.add(renamedTo.name);
            changes.push({
                table: name,
                changeType: 'COLUMN_RENAMED',
                column: renamedTo.name,
                oldColumn: removed.name,
                newColumn: renamedTo.name,
                oldType: removed.col.type,
                newType: renamedTo.col.type,
            });
        }
        for (const added of addedColumns) {
            if (usedAdded.has(added.name))
                continue;
            changes.push({
                table: name,
                changeType: 'COLUMN_ADDED',
                column: added.name,
                newType: added.col.type,
            });
        }
        for (const removed of removedColumns) {
            if (usedRemoved.has(removed.name))
                continue;
            changes.push({
                table: name,
                changeType: 'COLUMN_REMOVED',
                column: removed.name,
                oldType: removed.col.type,
            });
        }
    }
    for (const [name] of oldTables) {
        if (!newTables.has(name)) {
            changes.push({ table: name, changeType: 'TABLE_REMOVED' });
        }
    }
    return changes;
}
//# sourceMappingURL=analyzer.js.map