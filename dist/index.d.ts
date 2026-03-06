#!/usr/bin/env node
import { postSchemaChanges } from './api.js';
import type { GitHubClient } from './github.js';
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
    reportSlack: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
    reportKafka: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
    reportGitHubComment: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
};
export declare function buildGitHubCommentBody(changes: SchemaChange[], prUrl?: string): string;
export declare function reportGitHubCommentDefault(args: CLIArgs, changes: SchemaChange[], createClient?: (token: string) => GitHubClient): Promise<void>;
export declare function runSchemaWatcher(args: CLIArgs, deps?: Partial<RuntimeDeps>): Promise<void>;
export declare function runGit(args: string[]): string[];
export declare function detectSchemaChangesFromWorkspace(opts?: {
    includeAllFiles?: boolean;
}): SchemaChange[];
export declare function main(): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map