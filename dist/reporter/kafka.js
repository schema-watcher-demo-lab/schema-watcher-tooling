"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKafkaReporter = createKafkaReporter;
const kafkajs_1 = require("kafkajs");
function createKafkaReporter(broker, topic) {
    const kafka = new kafkajs_1.Kafka({ brokers: [broker] });
    const producer = kafka.producer();
    let connected = false;
    return {
        async report(changes, repo, pr) {
            if (!connected) {
                await producer.connect();
                connected = true;
            }
            const breaking = changes.filter(c => c.changeType === 'TABLE_REMOVED' ||
                c.changeType === 'COLUMN_REMOVED' ||
                c.changeType === 'COLUMN_TYPE_CHANGED').length;
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
        async disconnect() {
            if (connected) {
                await producer.disconnect();
                connected = false;
            }
        },
    };
}
//# sourceMappingURL=kafka.js.map