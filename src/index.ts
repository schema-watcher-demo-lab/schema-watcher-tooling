#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { postSchemaChanges } from './api.js';
import { analyzeChanges } from './analyzer.js';
import { isSchemaFile } from './detector.js';
import { ParserRegistry } from './parser/index.js';
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

export function parseArgs(argv: string[]): CLIArgs {
  const program = new Command();
  
  program
    .exitOverride()
    .name('crew-schema-watcher')
    .description('Schema Watcher - Autonomous agent for schema change detection')
    .requiredOption('-r, --repo <owner/name>', 'Repository (owner/name)')
    .option('-p, --pr <number>', 'PR number')
    .option('--organization-id <id>', 'Organization ID for disambiguation')
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

type RuntimeDeps = {
  postSchemaChanges: typeof postSchemaChanges;
  detectChanges: () => SchemaChange[];
};

export async function runSchemaWatcher(
  args: CLIArgs,
  deps: RuntimeDeps = { postSchemaChanges, detectChanges: detectSchemaChangesFromWorkspace }
): Promise<void> {
  if (args.init) {
    console.log('Initial scan not implemented yet');
    return;
  }

  if (!args.pr) {
    throw new Error('--pr is required for PR mode');
  }

  console.log(`Running schema watcher for ${args.repo} PR #${args.pr}`);

  if (args.dryRun) {
    console.log('Dry run enabled, skipping API report');
    return;
  }

  const apiKey = args.apiKey || process.env.CREW_API_KEY;
  if (!apiKey) {
    console.log('No API key provided, skipping API report');
    return;
  }
  const changes = deps.detectChanges();
  console.log(`Detected ${changes.length} schema change(s)`);

  await deps.postSchemaChanges({
    apiEndpoint: args.apiEndpoint,
    apiKey,
    repo: args.repo,
    pr: args.pr,
    organizationId: args.organizationId,
    changes,
  });

  console.log('Reported schema changes to API');
}

function runGit(command: string): string[] {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!output) return [];
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readFileSafe(path: string): string {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function readFileFromGit(path: string): string {
  try {
    return execSync(`git show HEAD:${path}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function walkFiles(root: string): string[] {
  const results: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function detectSchemaChangesFromWorkspace(): SchemaChange[] {
  const parser = new ParserRegistry();
  const changedFiles = new Set<string>([
    ...runGit('git diff --name-only HEAD'),
    ...runGit('git diff --cached --name-only'),
    ...runGit('git diff --name-only HEAD~1 HEAD'),
  ]);
  if (changedFiles.size === 0) {
    // Local act fallback: workspace may not have git metadata.
    const cwd = process.cwd();
    for (const absoluteFilePath of walkFiles(cwd)) {
      const relativePath = path.relative(cwd, absoluteFilePath);
      if (isSchemaFile(relativePath)) {
        changedFiles.add(relativePath);
      }
    }
  }

  const schemaFiles = [...changedFiles].filter(isSchemaFile);
  const changes: SchemaChange[] = [];

  for (const filePath of schemaFiles) {
    const oldContent = readFileFromGit(filePath);
    const newContent = readFileSafe(filePath);
    const oldSchema = parser.parse(oldContent, filePath);
    const newSchema = parser.parse(newContent, filePath);
    changes.push(...analyzeChanges(oldSchema, newSchema));
  }

  return changes;
}

export async function main() {
  try {
    const args = parseArgs(process.argv);
    
    if (args.slackWebhook) {
      validateUrl(args.slackWebhook, 'Slack webhook URL');
    }

    await runSchemaWatcher(args);
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
