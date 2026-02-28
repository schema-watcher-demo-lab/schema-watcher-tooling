"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubClientWithOctokit = createGitHubClientWithOctokit;
exports.createGitHubClient = createGitHubClient;
exports.parseGitHubDiff = parseGitHubDiff;
const octokit_1 = require("octokit");
const diff = __importStar(require("diff"));
function mapFileStatus(status) {
    switch (status) {
        case 'added':
        case 'deleted':
            return status;
        case 'renamed':
        case 'modified':
        default:
            return 'modified';
    }
}
async function withRetry(fn, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (error && typeof error === 'object' && 'status' in error) {
                const status = error.status;
                if (status === 403 || status === 429) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.warn(`Rate limited, retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
            throw error;
        }
    }
    throw lastError;
}
async function getFileContentAtRef(octokit, owner, repo, filePath, ref) {
    try {
        const { data } = await withRetry(() => octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref,
        }));
        if (Array.isArray(data))
            return '';
        if (!data || typeof data !== 'object')
            return '';
        const blob = data;
        if (!blob.content)
            return '';
        if (blob.encoding === 'base64') {
            return Buffer.from(blob.content, 'base64').toString('utf8');
        }
        return blob.content;
    }
    catch {
        return '';
    }
}
function createGitHubClientWithOctokit(octokit) {
    return {
        async getPRDiffs(owner, repo, prNumber) {
            return withRetry(async () => {
                const { data: files } = await octokit.rest.pulls.listFiles({
                    owner,
                    repo,
                    pull_number: prNumber,
                });
                const { data: pull } = await octokit.rest.pulls.get({
                    owner,
                    repo,
                    pull_number: prNumber,
                });
                const baseSha = pull.base?.sha;
                const headSha = pull.head?.sha;
                if (!baseSha || !headSha) {
                    throw new Error('Missing pull request base/head SHA');
                }
                const diffs = await Promise.all(files.map(async (file) => {
                    const status = mapFileStatus(file.status);
                    if (status === 'added') {
                        return {
                            filePath: file.filename,
                            oldContent: '',
                            newContent: await getFileContentAtRef(octokit, owner, repo, file.filename, headSha),
                            status,
                        };
                    }
                    if (status === 'deleted') {
                        return {
                            filePath: file.filename,
                            oldContent: await getFileContentAtRef(octokit, owner, repo, file.filename, baseSha),
                            newContent: '',
                            status,
                        };
                    }
                    const oldPath = file.previous_filename || file.filename;
                    return {
                        filePath: file.filename,
                        oldContent: await getFileContentAtRef(octokit, owner, repo, oldPath, baseSha),
                        newContent: await getFileContentAtRef(octokit, owner, repo, file.filename, headSha),
                        status,
                    };
                }));
                return diffs;
            });
        },
        async postComment(owner, repo, prNumber, body) {
            await withRetry(async () => {
                await octokit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number: prNumber,
                    body,
                });
            });
        },
    };
}
function createGitHubClient(token) {
    return createGitHubClientWithOctokit(new octokit_1.Octokit({ auth: token }));
}
function parseGitHubDiff(diffContent) {
    if (!diffContent || typeof diffContent !== 'string') {
        return [];
    }
    const files = [];
    try {
        const patch = diff.parsePatch(diffContent);
        for (const file of patch) {
            if (!file.hunks || !file.oldFileName || !file.newFileName)
                continue;
            const oldPath = file.oldFileName.replace(/^a\//, '');
            const newPath = file.newFileName.replace(/^b\//, '');
            files.push({
                filePath: newPath !== '/dev/null' ? newPath : oldPath,
                oldContent: '',
                newContent: '',
                status: newPath === '/dev/null' ? 'deleted' : oldPath === '/dev/null' ? 'added' : 'modified',
            });
        }
    }
    catch (error) {
        console.error('Failed to parse diff:', error);
    }
    return files;
}
//# sourceMappingURL=github.js.map