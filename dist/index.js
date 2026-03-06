#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
exports.buildGitHubCommentBody = buildGitHubCommentBody;
exports.reportGitHubCommentDefault = reportGitHubCommentDefault;
exports.runSchemaWatcher = runSchemaWatcher;
exports.runGit = runGit;
exports.detectSchemaChangesFromWorkspace = detectSchemaChangesFromWorkspace;
exports.main = main;
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const api_js_1 = require("./api.js");
const analyzer_js_1 = require("./analyzer.js");
const detector_js_1 = require("./detector.js");
const github_js_1 = require("./github.js");
const index_js_1 = require("./parser/index.js");
const index_js_2 = require("./reporter/index.js");
function parseArgs(argv) {
    const program = new commander_1.Command();
    program
        .exitOverride()
        .name('crew-schema-watcher')
        .description('Schema Watcher - Autonomous agent for schema change detection')
        .requiredOption('-r, --repo <owner/name>', 'Repository (owner/name)')
        .option('-p, --pr <number>', 'PR number', (value) => {
        if (!/^\d+$/.test(value)) {
            throw new commander_1.InvalidArgumentError('--pr must be a positive integer');
        }
        const parsed = Number.parseInt(value, 10);
        if (parsed <= 0) {
            throw new commander_1.InvalidArgumentError('--pr must be a positive integer');
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
    return program.opts();
}
function validateUrl(url, name) {
    try {
        new URL(url);
    }
    catch {
        throw new Error(`Invalid ${name}: ${url}`);
    }
}
function buildSchemaUrls(args) {
    const sourceOrgId = args.schemaChangeOrganizationId;
    if (!sourceOrgId)
        return null;
    const repoParts = parseRepoOwnerAndName(args.repo);
    if (!repoParts?.repo)
        return null;
    if (!args.apiEndpoint)
        return null;
    try {
        const origin = new URL(args.apiEndpoint).origin;
        const base = `${origin}/schemas/${sourceOrgId}/${repoParts.repo}`;
        return { schemaUrl: base, historyUrl: `${base}/history` };
    }
    catch {
        return null;
    }
}
function buildPrCommentHeader(prUrl, urls) {
    if (!urls) {
        return `- [schema](${prUrl}) [change](${prUrl})`;
    }
    return `- [schema](${urls.schemaUrl}) [change](${urls.historyUrl})`;
}
function summarizeSchemaChange(change) {
    if (change.changeType === 'COLUMN_RENAMED' && change.oldColumn && change.newColumn) {
        return `${change.changeType} (\`${change.oldColumn}\` -> \`${change.newColumn}\`)`;
    }
    if (change.column) {
        return `${change.changeType} (\`${change.column}\`)`;
    }
    return change.changeType;
}
function buildGitHubCommentBody(changes, prUrl, schemaUrls) {
    const lines = changes.map(change => `- \`${change.table}\`: ${summarizeSchemaChange(change)}`);
    const header = prUrl
        ? `${buildPrCommentHeader(prUrl, schemaUrls ?? null)}

Detected schema diff:`
        : 'Schema diff:';
    return [
        github_js_1.SCHEMA_WATCHER_COMMENT_MARKER,
        '## Crew Schema Watcher',
        '',
        header,
        '',
        ...lines,
    ].join('\n');
}
async function reportSlackDefault(args, changes) {
    if (!args.slackWebhook)
        return;
    const reporter = (0, index_js_2.createSlackReporter)(args.slackWebhook);
    await reporter.report(changes, args.repo, args.pr ?? 0);
}
async function reportKafkaDefault(args, changes) {
    if (!args.kafkaBroker || !args.kafkaTopic)
        return;
    const reporter = (0, index_js_2.createKafkaReporter)(args.kafkaBroker, args.kafkaTopic);
    try {
        await reporter.report(changes, args.repo, args.pr ?? 0);
    }
    finally {
        await reporter.disconnect();
    }
}
function parseRepoOwnerAndName(repoRef) {
    const match = /^([^/]+)\/([^/]+)$/.exec(repoRef);
    if (!match) {
        return null;
    }
    return { owner: match[1], repo: match[2] };
}
async function reportGitHubCommentDefault(args, changes, createClient = github_js_1.createGitHubClient) {
    if (!args.pr)
        return;
    const eventName = process.env.GITHUB_EVENT_NAME;
    if (eventName && eventName !== 'pull_request')
        return;
    const token = process.env.GITHUB_TOKEN;
    if (!token)
        return;
    const repoRef = parseRepoOwnerAndName(args.repo);
    if (!repoRef) {
        throw new Error(`Invalid repo format: ${args.repo}. Expected owner/name`);
    }
    const client = createClient(token);
    const prUrl = `https://github.com/${args.repo}/pull/${args.pr}`;
    const schemaUrls = buildSchemaUrls(args);
    const body = buildGitHubCommentBody(changes, prUrl, schemaUrls);
    await client.upsertComment(repoRef.owner, repoRef.repo, args.pr, body);
}
async function runSchemaWatcher(args, deps = {
    postSchemaChanges: api_js_1.postSchemaChanges,
    detectChanges: detectSchemaChangesFromWorkspace,
    reportSlack: reportSlackDefault,
    reportKafka: reportKafkaDefault,
    reportGitHubComment: reportGitHubCommentDefault,
}) {
    const runtime = {
        postSchemaChanges: api_js_1.postSchemaChanges,
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
    let schemaChange = null;
    if (!apiReportingEnabled) {
        console.log('No API key provided, skipping API report');
    }
    else if (!apiEndpoint) {
        throw new Error('--api-endpoint (or SCHEMA_API_ENDPOINT) is required when API reporting is enabled');
    }
    const changes = runtime.detectChanges({ includeAllFiles: args.init });
    console.log(`Detected ${changes.length} schema change(s)`);
    if (changes.length === 0) {
        console.log('No schema changes detected, skipping API report');
        return;
    }
    if (apiReportingEnabled) {
        schemaChange = await runtime.postSchemaChanges({
            apiEndpoint: apiEndpoint,
            apiKey: apiKey,
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
            await runtime.reportGitHubComment({
                ...args,
                schemaChangeOrganizationId: schemaChange?.organizationId,
            }, changes);
        }
        catch (error) {
            console.warn('GitHub comment reporting failed:', error instanceof Error ? error.message : String(error));
        }
    }
    try {
        await runtime.reportSlack(args, changes);
    }
    catch (error) {
        console.warn("Slack reporting failed:", error instanceof Error ? error.message : String(error));
    }
    try {
        await runtime.reportKafka(args, changes);
    }
    catch (error) {
        console.warn("Kafka reporting failed:", error instanceof Error ? error.message : String(error));
    }
    if (reportedToApi) {
        console.log('Reported schema changes to API');
    }
}
function runGit(args) {
    try {
        const output = (0, child_process_1.execFileSync)('git', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (!output)
            return [];
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
function readFileSafe(path) {
    try {
        return fs_1.default.readFileSync(path, 'utf8');
    }
    catch {
        return '';
    }
}
function readFileFromGit(revision, path) {
    try {
        return (0, child_process_1.execFileSync)('git', ['show', `${revision}:${path}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    }
    catch {
        return '';
    }
}
function walkFiles(root) {
    const results = [];
    const stack = [root];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current)
            continue;
        let entries = [];
        try {
            entries = fs_1.default.readdirSync(current, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
                continue;
            }
            const fullPath = path_1.default.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            }
            else if (entry.isFile()) {
                results.push(fullPath);
            }
        }
    }
    return results;
}
function normalizeRevision(value) {
    const normalized = value?.trim();
    if (!normalized) {
        return null;
    }
    if (/^0+$/.test(normalized)) {
        return null;
    }
    return normalized;
}
function resolvePullRequestMergeBaseSha() {
    const prBaseSha = normalizeRevision(process.env.PR_BASE_SHA);
    if (!prBaseSha) {
        return null;
    }
    return runGit(['merge-base', prBaseSha, 'HEAD'])[0] ?? null;
}
function resolvePushRange() {
    const before = normalizeRevision(process.env.PUSH_BEFORE_SHA
        ?? process.env.GITHUB_EVENT_BEFORE
        ?? process.env.GITHUB_BEFORE_SHA
        ?? process.env.BEFORE_SHA);
    const after = normalizeRevision(process.env.PUSH_AFTER_SHA
        ?? process.env.GITHUB_EVENT_AFTER
        ?? process.env.GITHUB_AFTER_SHA
        ?? process.env.GITHUB_SHA
        ?? process.env.AFTER_SHA);
    if (!before || !after || before === after) {
        return null;
    }
    return { before, after };
}
function detectSchemaChangesFromWorkspace(opts) {
    const parser = new index_js_1.ParserRegistry();
    const includeAllFiles = opts?.includeAllFiles === true;
    const prMergeBaseRevision = includeAllFiles ? null : resolvePullRequestMergeBaseSha();
    const pushRange = includeAllFiles || prMergeBaseRevision ? null : resolvePushRange();
    const changedFiles = new Set();
    if (includeAllFiles) {
        const cwd = process.cwd();
        for (const absoluteFilePath of walkFiles(cwd)) {
            const relativePath = path_1.default.relative(cwd, absoluteFilePath);
            if ((0, detector_js_1.isSchemaFile)(relativePath)) {
                changedFiles.add(relativePath);
            }
        }
    }
    else {
        if (prMergeBaseRevision) {
            for (const file of runGit(['diff', '--name-only', `${prMergeBaseRevision}...HEAD`]))
                changedFiles.add(file);
        }
        else if (pushRange) {
            for (const file of runGit(['diff', '--name-only', pushRange.before, pushRange.after]))
                changedFiles.add(file);
        }
        else {
            for (const file of runGit(['diff', '--name-only', 'HEAD']))
                changedFiles.add(file);
            for (const file of runGit(['diff', '--cached', '--name-only']))
                changedFiles.add(file);
            for (const file of runGit(['show', '--name-only', '--pretty=', 'HEAD']))
                changedFiles.add(file);
        }
    }
    const schemaFiles = [...changedFiles].filter(detector_js_1.isSchemaFile);
    if (schemaFiles.length === 0)
        return [];
    const changes = [];
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
        const oldContent = includeAllFiles ? '' : readFileFromGit(baseRevision, filePath);
        const newContent = includeAllFiles
            ? readFileSafe(filePath)
            : (newRevision ? readFileFromGit(newRevision, filePath) : readFileSafe(filePath));
        const oldSchema = parser.parse(oldContent, filePath);
        const newSchema = parser.parse(newContent, filePath);
        changes.push(...(0, analyzer_js_1.analyzeChanges)(oldSchema, newSchema));
    }
    return changes;
}
async function main() {
    try {
        const args = parseArgs(process.argv);
        if (args.slackWebhook) {
            validateUrl(args.slackWebhook, 'Slack webhook URL');
        }
        if ((args.kafkaBroker && !args.kafkaTopic) || (!args.kafkaBroker && args.kafkaTopic)) {
            throw new Error('Both --kafka-broker and --kafka-topic are required for Kafka reporting');
        }
        await runSchemaWatcher(args);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exit(1);
    }
}
const isDirectRun = typeof require !== 'undefined' &&
    typeof module !== 'undefined' &&
    require.main === module;
if (isDirectRun) {
    main();
}
//# sourceMappingURL=index.js.map