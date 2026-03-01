import { Kafka } from 'kafkajs';
import { countBreakingChanges } from '../breaking.js';
import type { SchemaChange } from '../types.js';

export interface KafkaReporter {
  report(changes: SchemaChange[], repo: string, pr: number): Promise<void>;
  disconnect(): Promise<void>;
}

export function createKafkaReporter(broker: string, topic: string): KafkaReporter {
  const kafka = new Kafka({ brokers: [broker] });
  const producer = kafka.producer();
  
  let connected = false;
  
  return {
    async report(changes: SchemaChange[], repo: string, pr: number): Promise<void> {
      if (!connected) {
        await producer.connect();
        connected = true;
      }
      
      const breaking = countBreakingChanges(changes);
      
      await producer.send({
        topic,
        messages: [
          {
            key: `${repo}#${pr}`,
            value: JSON.stringify({
              event: 'schema_change',
              repo,
              pr,
              changes: changes.map(c => ({
                table: c.table,
                column: c.column,
                changeType: c.changeType,
                oldType: c.oldType,
                newType: c.newType,
              })),
              breaking,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      });
    },
    
    async disconnect(): Promise<void> {
      if (connected) {
        await producer.disconnect();
        connected = false;
      }
    },
  };
}
