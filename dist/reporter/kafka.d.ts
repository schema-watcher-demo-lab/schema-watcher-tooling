import type { SchemaChange } from '../types.js';
export interface KafkaReporter {
    report(changes: SchemaChange[], repo: string, pr: number): Promise<void>;
    disconnect(): Promise<void>;
}
export declare function createKafkaReporter(broker: string, topic: string): KafkaReporter;
//# sourceMappingURL=kafka.d.ts.map