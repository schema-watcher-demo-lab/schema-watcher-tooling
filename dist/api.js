"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSchemaChanges = postSchemaChanges;
function normalizeEndpoint(endpoint) {
    return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}
function isPrivateHostname(hostname) {
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return true;
    }
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) {
        return true;
    }
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
        const first = Number(parts[0]);
        const second = Number(parts[1]);
        if (first === 172 && second >= 16 && second <= 31)
            return true;
    }
    return false;
}
function validateApiEndpoint(endpoint) {
    let parsed;
    try {
        parsed = new URL(endpoint);
    }
    catch {
        throw new Error(`Invalid API endpoint: ${endpoint}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error(`Unsupported API endpoint protocol: ${parsed.protocol}`);
    }
    if (isPrivateHostname(parsed.hostname) && process.env.ALLOW_PRIVATE_API_ENDPOINTS !== "1") {
        throw new Error(`Disallowed private API endpoint host: ${parsed.hostname}`);
    }
    return parsed;
}
async function postSchemaChanges(input) {
    const validated = validateApiEndpoint(input.apiEndpoint);
    const url = `${normalizeEndpoint(validated.toString())}/api/changes`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': input.apiKey,
        },
        body: JSON.stringify({
            repo: input.repo,
            pr: input.pr,
            organizationId: input.organizationId,
            changes: input.changes,
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Schema API request failed (${response.status}): ${body}`);
    }
}
//# sourceMappingURL=api.js.map