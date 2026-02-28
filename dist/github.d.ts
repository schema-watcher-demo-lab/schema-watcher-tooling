import type { FileDiff } from './types.js';
export interface GitHubClient {
    getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]>;
    postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
}
type OctokitLike = {
    rest: {
        pulls: {
            listFiles(params: {
                owner: string;
                repo: string;
                pull_number: number;
            }): Promise<{
                data: Array<{
                    filename: string;
                    status: string;
                    previous_filename?: string;
                }>;
            }>;
            get(params: {
                owner: string;
                repo: string;
                pull_number: number;
            }): Promise<{
                data: {
                    base?: {
                        sha?: string;
                    };
                    head?: {
                        sha?: string;
                    };
                };
            }>;
        };
        repos: {
            getContent(params: {
                owner: string;
                repo: string;
                path: string;
                ref?: string;
            }): Promise<{
                data: unknown;
            }>;
        };
        issues: {
            createComment(params: {
                owner: string;
                repo: string;
                issue_number: number;
                body: string;
            }): Promise<unknown>;
        };
    };
};
export declare function createGitHubClientWithOctokit(octokit: OctokitLike): GitHubClient;
export declare function createGitHubClient(token: string): GitHubClient;
export declare function parseGitHubDiff(diffContent: string): FileDiff[];
export {};
//# sourceMappingURL=github.d.ts.map