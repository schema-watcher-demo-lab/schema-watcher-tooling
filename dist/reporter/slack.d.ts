import type { SchemaChange } from '../types.js';
export interface SlackReporter {
    report(changes: SchemaChange[], repo: string, pr: number): Promise<void>;
}
export declare function createSlackReporter(webhookUrl: string): SlackReporter;
//# sourceMappingURL=slack.d.ts.map