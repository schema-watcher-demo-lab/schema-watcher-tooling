#!/usr/bin/env node

import { Command } from 'commander';

export interface CLIArgs {
  repo: string;
  pr?: number;
  apiEndpoint: string;
  apiKey?: string;
  dryRun: boolean;
  init: boolean;
  slackWebhook?: string;
  kafkaBroker?: string;
  kafkaTopic?: string;
}

export function parseArgs(argv: string[]): CLIArgs {
  const program = new Command();
  
  program
    .exitOverride()
    .name('crew-schema-watcher')
    .description('Schema Watcher - Autonomous agent for schema change detection')
    .requiredOption('-r, --repo <owner/name>', 'Repository (owner/name)')
    .option('-p, --pr <number>', 'PR number')
    .option('--api-endpoint <url>', 'Schema storage API endpoint', 'http://localhost:3000')
    .option('--api-key <key>', 'API key for schema storage')
    .option('--dry-run', 'Skip reporting, just output results', false)
    .option('--init', 'Initial full project scan (bootstrap)', false)
    .option('--slack-webhook <url>', 'Slack webhook URL')
    .option('--kafka-broker <address>', 'Kafka broker address')
    .option('--kafka-topic <topic>', 'Kafka topic name');

  program.parse(argv);
  return program.opts() as CLIArgs;
}

function validateUrl(url: string, name: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid ${name}: ${url}`);
  }
}

export async function main() {
  try {
    const args = parseArgs(process.argv);
    
    if (args.slackWebhook) {
      validateUrl(args.slackWebhook, 'Slack webhook URL');
    }

    if (args.init) {
      console.log('Initial scan not implemented yet');
      return;
    }

    if (!args.pr) {
      console.error('Error: --pr is required for PR mode');
      process.exit(1);
    }

    console.log(`Running schema watcher for ${args.repo} PR #${args.pr}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
