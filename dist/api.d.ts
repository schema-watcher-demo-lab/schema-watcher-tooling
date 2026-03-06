import { lookup } from "node:dns/promises";
import type { SchemaChange } from './types.js';
export interface PostSchemaChangesInput {
    apiEndpoint: string;
    apiKey: string;
    repo: string;
    pr: number;
    organizationId?: string;
    changes: SchemaChange[];
    event?: "pr" | "merge" | "close";
}
export interface PostSchemaChangesResult {
    id: string;
    repositoryId: string;
    organizationId: string;
    pr: number;
    changes: string;
    status: string;
    isBreaking: boolean;
    createdAt: string;
}
export interface PostSchemaChangesResult {
    id: string;
    repositoryId: string;
    organizationId: string;
    pr: number;
    changes: string;
    status: string;
    isBreaking: boolean;
    createdAt: string;
}
type LookupFn = typeof lookup;
export declare function setLookupForTests(nextLookup: LookupFn | null): void;
export declare function postSchemaChanges(input: PostSchemaChangesInput): Promise<PostSchemaChangesResult>;
export {};
//# sourceMappingURL=api.d.ts.map