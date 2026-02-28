"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSchemaFile = isSchemaFile;
exports.detectSchemaFiles = detectSchemaFiles;
const SCHEMA_PATTERNS = [
    /\.prisma$/,
    /(^|\/)drizzle\/.*\.(ts|js)$/,
    /(^|\/)(db\/)?schema\.(ts|js)$/,
    /(^|\/)schemas\/.*\.(avsc|proto|schema\.json)$/,
    /(^|\/)metrics\/contracts\.(yml|yaml)$/,
    /(^|\/)logs_traces\/contracts\.(yml|yaml)$/,
    /\/dbt\/models\//,
    /\/dbt\/schemas\//,
    /models\/.*\.(yml|yaml|sql)$/,
    /(^|\/)migrations?\//,
    /\/db\/migrations?\//,
    /\/db\/migrate\//,
    /\/migrate\//,
    /\/models\.py$/,
    /(^|\/)(models|entities)\/.*\.py$/,
    /\/entities\/.*\.ts$/,
];
function isSchemaFile(filePath) {
    return SCHEMA_PATTERNS.some(pattern => pattern.test(filePath));
}
function detectSchemaFiles(changes) {
    return changes.filter(change => isSchemaFile(change.filePath));
}
//# sourceMappingURL=detector.js.map