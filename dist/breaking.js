"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countBreakingChanges = countBreakingChanges;
const BREAKING_TYPES = new Set([
    "TABLE_REMOVED",
    "COLUMN_REMOVED",
    "COLUMN_TYPE_CHANGED",
    "COLUMN_NULLABLE_CHANGED",
    "COLUMN_DEFAULT_CHANGED",
    "COLUMN_RENAMED",
]);
function countBreakingChanges(changes) {
    return changes.filter((change) => BREAKING_TYPES.has(change.changeType)).length;
}
//# sourceMappingURL=breaking.js.map