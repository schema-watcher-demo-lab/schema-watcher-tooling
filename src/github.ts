import { Octokit } from 'octokit';
import type { FileDiff } from './types.js';
import * as diff from 'diff';

export interface GitHubClient {
  getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]>;
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
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
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        
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

type OctokitLike = {
  rest: {
    pulls: {
      listFiles(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: Array<{ filename: string; status: string; previous_filename?: string }> }>;
      get(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: { base?: { sha?: string }; head?: { sha?: string } } }>;
    };
    repos: {
      getContent(params: { owner: string; repo: string; path: string; ref?: string }): Promise<{ data: unknown }>;
    };
    issues: {
      createComment(params: { owner: string; repo: string; issue_number: number; body: string }): Promise<unknown>;
    };
  };
};

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
  } catch {
    return '';
  }
}

export function createGitHubClientWithOctokit(octokit: OctokitLike): GitHubClient {
  return {
    async getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]> {
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
