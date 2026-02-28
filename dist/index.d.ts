#!/usr/bin/env node
import { postSchemaChanges } from './api.js';
import type { SchemaChange } from './types.js';
export interface CLIArgs {
    repo: string;
    pr?: number;
    organizationId?: string;
    apiEndpoint: string;
    apiKey?: string;
    dryRun: boolean;
    init: boolean;
    slackWebhook?: string;
    kafkaBroker?: string;
    kafkaTopic?: string;
}
export declare function parseArgs(argv: string[]): CLIArgs;
type RuntimeDeps = {
    postSchemaChanges: typeof postSchemaChanges;
    detectChanges: (opts?: {
        includeAllFiles?: boolean;
    }) => SchemaChange[];
};
export declare function runSchemaWatcher(args: CLIArgs, deps?: RuntimeDeps): Promise<void>;
export declare function detectSchemaChangesFromWorkspace(opts?: {
    includeAllFiles?: boolean;
}): SchemaChange[];
export declare function main(): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map