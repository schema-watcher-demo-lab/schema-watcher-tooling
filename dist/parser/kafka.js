"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAvroSchema = parseAvroSchema;
exports.parseProtoSchema = parseProtoSchema;
exports.parseJsonEventSchema = parseJsonEventSchema;
function parseAvroSchema(content) {
    try {
        const parsed = JSON.parse(content);
        if (!parsed.name || !parsed.fields)
            return [];
        const columns = {};
        for (const field of parsed.fields) {
            const type = typeof field.type === 'string' ? field.type : field.type.type;
            columns[field.name] = { type, nullable: true };
        }
        return [{ name: parsed.name, columns }];
    }
    catch {
        return [];
    }
}
function parseProtoSchema(content) {
    const messageMatch = content.match(/message\s+(\w+)\s*\{([\s\S]*?)\}/m);
    if (!messageMatch)
        return [];
    const name = messageMatch[1];
    const body = messageMatch[2];
    const columns = {};
    const fieldRegex = /^\s*(\w+)\s+(\w+)\s*=\s*\d+\s*;/gm;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
        const type = fieldMatch[1].toLowerCase();
        const field = fieldMatch[2];
        columns[field] = { type, nullable: true };
    }
    if (Object.keys(columns).length === 0)
        return [];
    return [{ name, columns }];
}
function parseJsonEventSchema(content) {
    try {
        const parsed = JSON.parse(content);
        if (!parsed.properties)
            return [];
        const tableName = parsed.title || 'EventSchema';
        const required = new Set(parsed.required ?? []);
        const columns = {};
        for (const [name, prop] of Object.entries(parsed.properties)) {
            columns[name] = {
                type: prop.type ?? 'unknown',
                nullable: !required.has(name),
            };
        }
        return [{ name: tableName, columns }];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=kafka.js.map