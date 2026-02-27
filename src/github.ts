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

export function createGitHubClient(token: string): GitHubClient {
  const octokit = new Octokit({ auth: token });
  
  return {
    async getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]> {
      return withRetry(async () => {
        const { data: files } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
        });
        
        return files.map(file => ({
          filePath: file.filename,
          oldContent: file.patch || '',
          newContent: file.patch || '',
          status: mapFileStatus(file.status),
        }));
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
      
      files.push({
        filePath: newPath !== '/dev/null' ? newPath : oldPath,
        oldContent: '',
        newContent: '',
        status: newPath === '/dev/null' ? 'deleted' : oldPath === '/dev/null' ? 'added' : 'modified',
      });
    }
  } catch (error) {
    console.error('Failed to parse diff:', error);
  }
  
  return files;
}
