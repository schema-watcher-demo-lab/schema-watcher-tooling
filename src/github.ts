import { Octokit } from 'octokit';
import type { FileDiff } from './types.js';
import * as diff from 'diff';

export interface GitHubClient {
  getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]>;
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
  upsertComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
}

export const SCHEMA_WATCHER_COMMENT_MARKER = '<!-- crew-schema-watcher -->';
const GITHUB_ACTIONS_BOT_LOGIN = 'github-actions[bot]';

function withSingleSchemaWatcherMarker(body: string): string {
  const bodyWithoutMarkers = body.split(SCHEMA_WATCHER_COMMENT_MARKER).join('').trimStart();
  return `${SCHEMA_WATCHER_COMMENT_MARKER}\n${bodyWithoutMarkers}`;
}

function mapFileStatus(status: string): 'added' | 'modified' | 'deleted' {
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | undefined;
  const baseDelayMs = 100;

  const getRetryDelayMs = (error: unknown, attempt: number): number => {
    if (!error || typeof error !== 'object') {
      return Math.pow(2, attempt) * baseDelayMs;
    }

    const response = (error as { response?: unknown }).response;
    if (response && typeof response === 'object') {
      const headers = (response as { headers?: unknown }).headers;

      const retryAfterValue = (() => {
        if (!headers) return undefined;
        if (headers instanceof Headers) {
          return headers.get('retry-after') ?? undefined;
        }
        if (typeof headers === 'object') {
          const retryAfter = (headers as Record<string, unknown>)['retry-after'];
          return typeof retryAfter === 'string' ? retryAfter : undefined;
        }
        return undefined;
      })();

      if (retryAfterValue) {
        const seconds = Number(retryAfterValue);
        if (!Number.isNaN(seconds)) {
          return Math.max(0, seconds * 1000);
        }

        const when = Date.parse(retryAfterValue);
        if (!Number.isNaN(when)) {
          return Math.max(0, when - Date.now());
        }
      }
    }

    return Math.pow(2, attempt) * baseDelayMs;
  };

  const shouldRetry = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
      return false;
    }

    if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
      const status = (error as { status: number }).status;
      if (status === 403 || status === 429) return true;
      if (status >= 500 && status <= 599) return true;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      const transientCodes = new Set([
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'EAI_AGAIN',
      ]);
      if (transientCodes.has(code)) return true;
    }

    return false;
  };
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (shouldRetry(error) && attempt < maxRetries - 1) {
        const waitTime = getRetryDelayMs(error, attempt);
        console.warn(`Request failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }
  
  throw lastError;
}

type OctokitLike = {
  rest: {
    pulls: {
      listFiles(params: { owner: string; repo: string; pull_number: number; per_page?: number; page?: number }): Promise<{ data: Array<{ filename: string; status: string; previous_filename?: string }> }>;
      get(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: { base?: { sha?: string }; head?: { sha?: string } } }>;
    };
    repos: {
      getContent(params: { owner: string; repo: string; path: string; ref?: string }): Promise<{ data: unknown }>;
    };
    issues: {
      createComment(params: { owner: string; repo: string; issue_number: number; body: string }): Promise<unknown>;
      listComments(params: { owner: string; repo: string; issue_number: number; per_page?: number; page?: number }): Promise<{ data: Array<{ id: number; body?: string | null; user?: { login?: string | null } | null }> }>;
      updateComment(params: { owner: string; repo: string; comment_id: number; body: string }): Promise<unknown>;
      deleteComment?(params: { owner: string; repo: string; comment_id: number }): Promise<unknown>;
    };
  };
};

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

async function listAllPRFiles(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Array<{ filename: string; status: string; previous_filename?: string }>> {
  const files: Array<{ filename: string; status: string; previous_filename?: string }> = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
      page,
    });
    files.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return files;
}

async function listAllIssueComments(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Array<{ id: number; body?: string | null; user?: { login?: string | null } | null }>> {
  const comments: Array<{ id: number; body?: string | null; user?: { login?: string | null } | null }> = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
      page,
    });
    comments.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return comments;
}

async function getFileContentAtRef(
  octokit: OctokitLike,
  owner: string,
  repo: string,
  filePath: string,
  ref: string,
): Promise<string> {
  try {
    const { data } = await withRetry(() =>
      octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref,
      })
    );

    if (Array.isArray(data)) return '';
    if (!data || typeof data !== 'object') return '';

    const blob = data as { content?: string; encoding?: string };
    if (!blob.content) return '';
    if (blob.encoding === 'base64') {
      return Buffer.from(blob.content, 'base64').toString('utf8');
    }
    return blob.content;
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      return '';
    }
    throw error;
  }
}

export function createGitHubClientWithOctokit(octokit: OctokitLike): GitHubClient {
  return {
    async getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]> {
      return withRetry(async () => {
        const files = await listAllPRFiles(octokit, owner, repo, prNumber);

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

        const diffs = await Promise.all(
          files.map(async (file) => {
            const status = mapFileStatus(file.status);
            if (status === 'added') {
              return {
                filePath: file.filename,
                oldContent: '',
                newContent: await getFileContentAtRef(octokit, owner, repo, file.filename, headSha),
                status,
              } satisfies FileDiff;
            }
            if (status === 'deleted') {
              return {
                filePath: file.filename,
                oldContent: await getFileContentAtRef(octokit, owner, repo, file.filename, baseSha),
                newContent: '',
                status,
              } satisfies FileDiff;
            }

            const oldPath = file.previous_filename || file.filename;
            return {
              filePath: file.filename,
              oldContent: await getFileContentAtRef(octokit, owner, repo, oldPath, baseSha),
              newContent: await getFileContentAtRef(octokit, owner, repo, file.filename, headSha),
              status,
            } satisfies FileDiff;
          })
        );

        return diffs;
      });
    },
    
    async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
      await withRetry(async () => {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        });
      });
    },

    async upsertComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
      const markerBody = withSingleSchemaWatcherMarker(body);

      await withRetry(async () => {
        const comments = await listAllIssueComments(octokit, owner, repo, prNumber);

        const botMarkerComments = comments.filter(
          (comment) =>
            typeof comment.body === 'string' &&
            comment.body.includes(SCHEMA_WATCHER_COMMENT_MARKER) &&
            comment.user?.login === GITHUB_ACTIONS_BOT_LOGIN,
        );

        const existingComment = botMarkerComments.reduce<typeof botMarkerComments[number] | undefined>(
          (newest, comment) => (newest === undefined || comment.id > newest.id ? comment : newest),
          undefined,
        );

        if (existingComment) {
          await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body: markerBody,
          });

          if (octokit.rest.issues.deleteComment) {
            const duplicateComments = botMarkerComments.filter((comment) => comment.id !== existingComment.id);
            for (const duplicateComment of duplicateComments) {
              try {
                await octokit.rest.issues.deleteComment({
                  owner,
                  repo,
                  comment_id: duplicateComment.id,
                });
              } catch {
                // Best effort cleanup only.
              }
            }
          }

          return;
        }

        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: markerBody,
        });
      });
    },
  };
}

export function createGitHubClient(token: string): GitHubClient {
  return createGitHubClientWithOctokit(new Octokit({ auth: token }));
}

export function parseGitHubDiff(diffContent: string): FileDiff[] {
  if (!diffContent || typeof diffContent !== 'string') {
    return [];
  }
  
  const files: FileDiff[] = [];
  
  try {
    const patch = diff.parsePatch(diffContent);
    
    for (const file of patch) {
      if (!file.hunks || !file.oldFileName || !file.newFileName) continue;

      const oldPath = file.oldFileName.replace(/^a\//, '');
      const newPath = file.newFileName.replace(/^b\//, '');
      const oldLines: string[] = [];
      const newLines: string[] = [];

      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (!line) continue;
          if (line.startsWith('\\')) continue;
          if (line.startsWith(' ') || line.startsWith('-')) oldLines.push(line.slice(1));
          if (line.startsWith(' ') || line.startsWith('+')) newLines.push(line.slice(1));
        }
      }

      files.push({
        filePath: newPath !== '/dev/null' ? newPath : oldPath,
        oldContent: oldPath === '/dev/null' ? '' : oldLines.join('\n'),
        newContent: newPath === '/dev/null' ? '' : newLines.join('\n'),
        status: newPath === '/dev/null' ? 'deleted' : oldPath === '/dev/null' ? 'added' : 'modified',
      });
    }
  } catch (error) {
    console.error('Failed to parse diff:', error);
  }
  
  return files;
}
