"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSlackReporter = createSlackReporter;
const webhook_1 = require("@slack/webhook");
function escapeSlack(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function createSlackReporter(webhookUrl) {
    const webhook = new webhook_1.IncomingWebhook(webhookUrl);
    return {
        async report(changes, repo, pr) {
            const breaking = changes.filter(c => c.changeType === 'TABLE_REMOVED' ||
                c.changeType === 'COLUMN_REMOVED' ||
                c.changeType === 'COLUMN_TYPE_CHANGED').length;
            const blocks = [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `Schema Changes Detected: ${escapeSlack(repo)} #${pr}`,
                    },
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Changes:*\n${changes.length}`,
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Breaking:*\n${breaking}`,
                        },
                    ],
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: changes.map(c => {
                            const icon = c.changeType.includes('ADDED') ? ':large_blue_circle:' :
                                c.changeType.includes('REMOVED') ? ':red_circle:' : ':warning:';
                            return `${icon} \`${escapeSlack(c.table)}\`${c.column ? `.${escapeSlack(c.column)}` : ''}: ${c.changeType}`;
                        }).join('\n'),
                    },
                },
            ];
            await webhook.send({ blocks });
        },
    };
}
//# sourceMappingURL=slack.js.map