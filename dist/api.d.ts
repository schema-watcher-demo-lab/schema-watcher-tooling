import type { SchemaChange } from './types.js';
export interface PostSchemaChangesInput {
    apiEndpoint: string;
    apiKey: string;
    repo: string;
    pr: number;
    organizationId?: string;
    changes: SchemaChange[];
}
export declare function postSchemaChanges(input: PostSchemaChangesInput): Promise<void>;
//# sourceMappingURL=api.d.ts.map