#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
exports.runSchemaWatcher = runSchemaWatcher;
exports.detectSchemaChangesFromWorkspace = detectSchemaChangesFromWorkspace;
exports.main = main;
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const api_js_1 = require("./api.js");
const analyzer_js_1 = require("./analyzer.js");
const detector_js_1 = require("./detector.js");
const index_js_1 = require("./parser/index.js");
function parseArgs(argv) {
    const program = new commander_1.Command();
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
async function runSchemaWatcher(args, deps = { postSchemaChanges: api_js_1.postSchemaChanges, detectChanges: detectSchemaChangesFromWorkspace }) {
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
function runGit(command) {
    try {
        const output = (0, child_process_1.execSync)(command, {
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
function readFileFromGit(path) {
    try {
        return (0, child_process_1.execSync)(`git show HEAD:${path}`, {
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
function detectSchemaChangesFromWorkspace() {
    const parser = new index_js_1.ParserRegistry();
    const changedFiles = new Set([
        ...runGit('git diff --name-only HEAD'),
        ...runGit('git diff --cached --name-only'),
        ...runGit('git diff --name-only HEAD~1 HEAD'),
    ]);
    if (changedFiles.size === 0) {
        // Local act fallback: workspace may not have git metadata.
        const cwd = process.cwd();
        for (const absoluteFilePath of walkFiles(cwd)) {
            const relativePath = path_1.default.relative(cwd, absoluteFilePath);
            if ((0, detector_js_1.isSchemaFile)(relativePath)) {
                changedFiles.add(relativePath);
            }
        }
    }
    const schemaFiles = [...changedFiles].filter(detector_js_1.isSchemaFile);
    const changes = [];
    for (const filePath of schemaFiles) {
        const oldContent = readFileFromGit(filePath);
        const newContent = readFileSafe(filePath);
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