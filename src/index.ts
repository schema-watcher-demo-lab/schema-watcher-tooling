#!/usr/bin/env node

import { Command, InvalidArgumentError } from 'commander';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { postSchemaChanges } from './api.js';
import { analyzeChanges } from './analyzer.js';
import { isSchemaFile } from './detector.js';
import { createGitHubClient, SCHEMA_WATCHER_COMMENT_MARKER } from './github.js';
import type { GitHubClient } from './github.js';
import { ParserRegistry } from './parser/index.js';
import type { SchemaChange } from './types.js';
import { createKafkaReporter, createSlackReporter } from './reporter/index.js';

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
    .option('-p, --pr <number>', 'PR number', (value: string) => {
      if (!/^\d+$/.test(value)) {
        throw new InvalidArgumentError('--pr must be a positive integer');
      }
      const parsed = Number.parseInt(value, 10);
      if (parsed <= 0) {
        throw new InvalidArgumentError('--pr must be a positive integer');
      }
      return parsed;
    })
    .option('--organization-id <id>', 'Organization ID for disambiguation')
    .option('--api-endpoint <url>', 'Schema storage API endpoint', '')
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
  detectChanges: (opts?: { includeAllFiles?: boolean }) => SchemaChange[];
  reportSlack: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
  reportKafka: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
  reportGitHubComment: (args: CLIArgs, changes: SchemaChange[]) => Promise<void>;
};

function buildPrCommentHeader(prUrl: string): string {
  return `- [schema](${prUrl}) [change](${prUrl})`;
}

function summarizeSchemaChange(change: SchemaChange): string {
  if (change.changeType === 'COLUMN_RENAMED' && change.oldColumn && change.newColumn) {
    return `${change.changeType} (\`${change.oldColumn}\` -> \`${change.newColumn}\`)`;
  }
  if (change.column) {
    return `${change.changeType} (\`${change.column}\`)`;
  }
  return change.changeType;
}

export function buildGitHubCommentBody(changes: SchemaChange[], prUrl?: string): string {
  const lines = changes.map(change => `- \`${change.table}\`: ${summarizeSchemaChange(change)}`);
  const header = prUrl
    ? `${buildPrCommentHeader(prUrl)}

Detected schema diff:`
    : 'Schema diff:';

  return [
    SCHEMA_WATCHER_COMMENT_MARKER,
    '## Crew Schema Watcher',
    '',
    header,
    '',
    ...lines,
  ].join('\n');
}

async function reportSlackDefault(args: CLIArgs, changes: SchemaChange[]): Promise<void> {
  if (!args.slackWebhook) return;
  const reporter = createSlackReporter(args.slackWebhook);
  await reporter.report(changes, args.repo, args.pr ?? 0);
}

async function reportKafkaDefault(args: CLIArgs, changes: SchemaChange[]): Promise<void> {
  if (!args.kafkaBroker || !args.kafkaTopic) return;
  const reporter = createKafkaReporter(args.kafkaBroker, args.kafkaTopic);
  try {
    await reporter.report(changes, args.repo, args.pr ?? 0);
  } finally {
    await reporter.disconnect();
  }
}

function parseRepoOwnerAndName(repoRef: string): { owner: string; repo: string } | null {
  const match = /^([^/]+)\/([^/]+)$/.exec(repoRef);
  if (!match) {
    return null;
  }
  return { owner: match[1], repo: match[2] };
}

export async function reportGitHubCommentDefault(
  args: CLIArgs,
  changes: SchemaChange[],
  createClient: (token: string) => GitHubClient = createGitHubClient,
): Promise<void> {
  if (!args.pr) return;

  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName && eventName !== 'pull_request') return;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return;

  const repoRef = parseRepoOwnerAndName(args.repo);
  if (!repoRef) {
    throw new Error(`Invalid repo format: ${args.repo}. Expected owner/name`);
  }

  const client = createClient(token);
  const prUrl = `https://github.com/${args.repo}/pull/${args.pr}`;
  const body = buildGitHubCommentBody(changes, prUrl);
  await client.upsertComment(repoRef.owner, repoRef.repo, args.pr, body);
}

export async function runSchemaWatcher(
  args: CLIArgs,
  deps: Partial<RuntimeDeps> = {
    postSchemaChanges,
    detectChanges: detectSchemaChangesFromWorkspace,
    reportSlack: reportSlackDefault,
    reportKafka: reportKafkaDefault,
    reportGitHubComment: reportGitHubCommentDefault,
  }
): Promise<void> {
  const runtime: RuntimeDeps = {
    postSchemaChanges,
    detectChanges: detectSchemaChangesFromWorkspace,
    reportSlack: reportSlackDefault,
    reportKafka: reportKafkaDefault,
    reportGitHubComment: reportGitHubCommentDefault,
    ...deps,
  };

  if (!args.pr) {
    throw new Error('--pr is required for PR mode');
  }

  if (args.init) {
    console.log('Initial scan mode enabled');
  }

  console.log(`Running schema watcher for ${args.repo} PR #${args.pr}`);

  if (args.dryRun) {
    console.log('Dry run enabled, skipping API report');
    return;
  }

  const apiKey = args.apiKey || process.env.CREW_API_KEY;
  const apiEndpoint = args.apiEndpoint || process.env.SCHEMA_API_ENDPOINT;
  const apiReportingEnabled = Boolean(apiKey);
  let reportedToApi = false;
  if (!apiReportingEnabled) {
    console.log('No API key provided, skipping API report');
  } else if (!apiEndpoint) {
    throw new Error('--api-endpoint (or SCHEMA_API_ENDPOINT) is required when API reporting is enabled');
  }

  const changes = runtime.detectChanges({ includeAllFiles: args.init });
  console.log(`Detected ${changes.length} schema change(s)`);

  if (changes.length === 0) {
    console.log('No schema changes detected, skipping API report');
    return;
  }

  if (apiReportingEnabled) {
    await runtime.postSchemaChanges({
      apiEndpoint: apiEndpoint!,
      apiKey: apiKey!,
      repo: args.repo,
      pr: args.pr,
      organizationId: args.organizationId,
      changes,
    });
    reportedToApi = true;
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const isPullRequestEvent = !eventName || eventName === 'pull_request';

  if (isPullRequestEvent && process.env.GITHUB_TOKEN) {
    try {
      await runtime.reportGitHubComment(args, changes);
    } catch (error) {
      console.warn('GitHub comment reporting failed:', error instanceof Error ? error.message : String(error));
    }
  }

  try {
    await runtime.reportSlack(args, changes);
  } catch (error) {
    console.warn("Slack reporting failed:", error instanceof Error ? error.message : String(error));
  }
  try {
    await runtime.reportKafka(args, changes);
  } catch (error) {
    console.warn("Kafka reporting failed:", error instanceof Error ? error.message : String(error));
  }
  if (reportedToApi) {
    console.log('Reported schema changes to API');
  }
}

export function runGit(args: string[]): string[] {
  try {
    const output = execFileSync('git', args, {
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

function readFileFromGit(revision: string, path: string): string {
  try {
    return execFileSync('git', ['show', `${revision}:${path}`], {
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

function normalizeRevision(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (/^0+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function resolvePullRequestMergeBaseSha(): string | null {
  const prBaseSha = normalizeRevision(process.env.PR_BASE_SHA);
  if (!prBaseSha) {
    return null;
  }

  return runGit(['merge-base', prBaseSha, 'HEAD'])[0] ?? null;
}

type PushRange = {
  before: string;
  after: string;
};

function resolvePushRange(): PushRange | null {
  const before = normalizeRevision(
    process.env.PUSH_BEFORE_SHA
      ?? process.env.GITHUB_EVENT_BEFORE
      ?? process.env.GITHUB_BEFORE_SHA
      ?? process.env.BEFORE_SHA
  );
  const after = normalizeRevision(
    process.env.PUSH_AFTER_SHA
      ?? process.env.GITHUB_EVENT_AFTER
      ?? process.env.GITHUB_AFTER_SHA
      ?? process.env.GITHUB_SHA
      ?? process.env.AFTER_SHA
  );

  if (!before || !after || before === after) {
    return null;
  }

  return { before, after };
}

export function detectSchemaChangesFromWorkspace(opts?: { includeAllFiles?: boolean }): SchemaChange[] {
  const parser = new ParserRegistry();
  const includeAllFiles = opts?.includeAllFiles === true;
  const prMergeBaseRevision = includeAllFiles ? null : resolvePullRequestMergeBaseSha();
  const pushRange = includeAllFiles || prMergeBaseRevision ? null : resolvePushRange();
  const changedFiles = new Set<string>();

  if (includeAllFiles) {
    const cwd = process.cwd();
    for (const absoluteFilePath of walkFiles(cwd)) {
      const relativePath = path.relative(cwd, absoluteFilePath);
      if (isSchemaFile(relativePath)) {
        changedFiles.add(relativePath);
      }
    }
  } else {
    if (prMergeBaseRevision) {
      for (const file of runGit(['diff', '--name-only', `${prMergeBaseRevision}...HEAD`])) changedFiles.add(file);
    } else if (pushRange) {
      for (const file of runGit(['diff', '--name-only', pushRange.before, pushRange.after])) changedFiles.add(file);
    } else {
      for (const file of runGit(['diff', '--name-only', 'HEAD'])) changedFiles.add(file);
      for (const file of runGit(['diff', '--cached', '--name-only'])) changedFiles.add(file);
      for (const file of runGit(['show', '--name-only', '--pretty=', 'HEAD'])) changedFiles.add(file);
    }
  }

  const schemaFiles = [...changedFiles].filter(isSchemaFile);
  if (schemaFiles.length === 0) return [];
  const changes: SchemaChange[] = [];
  const baseRevision = includeAllFiles
    ? null
    : (prMergeBaseRevision ?? pushRange?.before ?? runGit(['rev-parse', '--verify', 'HEAD~1'])[0] ?? null);
  const newRevision = includeAllFiles
    ? null
    : (pushRange?.after ?? null);

  if (!includeAllFiles && !baseRevision) {
    console.warn('Skipping schema detection: shallow clone missing HEAD~1 baseline');
    return [];
  }

  for (const filePath of schemaFiles) {
    const oldContent = includeAllFiles ? '' : readFileFromGit(baseRevision!, filePath);
    const newContent = includeAllFiles
      ? readFileSafe(filePath)
      : (newRevision ? readFileFromGit(newRevision, filePath) : readFileSafe(filePath));
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
    if ((args.kafkaBroker && !args.kafkaTopic) || (!args.kafkaBroker && args.kafkaTopic)) {
      throw new Error('Both --kafka-broker and --kafka-topic are required for Kafka reporting');
    }

    await runSchemaWatcher(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const isDirectRun =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (isDirectRun) {
  main();
}
