import { IncomingWebhook } from '@slack/webhook';
import type { SchemaChange } from '../types.js';

export interface SlackReporter {
  report(changes: SchemaChange[], repo: string, pr: number): Promise<void>;
}

function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createSlackReporter(webhookUrl: string): SlackReporter {
  const webhook = new IncomingWebhook(webhookUrl);
  
  return {
    async report(changes: SchemaChange[], repo: string, pr: number): Promise<void> {
      const breaking = changes.filter(c => 
        c.changeType === 'TABLE_REMOVED' || 
        c.changeType === 'COLUMN_REMOVED' ||
        c.changeType === 'COLUMN_TYPE_CHANGED'
      ).length;
      
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
