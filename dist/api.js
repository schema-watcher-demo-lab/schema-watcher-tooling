"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSchemaChanges = postSchemaChanges;
function normalizeEndpoint(endpoint) {
    return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}
async function postSchemaChanges(input) {
    const url = `${normalizeEndpoint(input.apiEndpoint)}/api/changes`;
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