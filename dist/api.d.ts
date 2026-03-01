import { lookup } from "node:dns/promises";
import type { SchemaChange } from './types.js';
export interface PostSchemaChangesInput {
    apiEndpoint: string;
    apiKey: string;
    repo: string;
    pr: number;
    organizationId?: string;
    changes: SchemaChange[];
}
type LookupFn = typeof lookup;
export declare function setLookupForTests(nextLookup: LookupFn | null): void;
export declare function postSchemaChanges(input: PostSchemaChangesInput): Promise<void>;
export {};
//# sourceMappingURL=api.d.ts.map