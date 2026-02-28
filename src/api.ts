import type { SchemaChange } from './types.js';

export interface PostSchemaChangesInput {
  apiEndpoint: string;
  apiKey: string;
  repo: string;
  pr: number;
  organizationId?: string;
  changes: SchemaChange[];
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}

export async function postSchemaChanges(input: PostSchemaChangesInput): Promise<void> {
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
