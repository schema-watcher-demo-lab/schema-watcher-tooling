import type { FileDiff } from './types.js';
export interface GitHubClient {
    getPRDiffs(owner: string, repo: string, prNumber: number): Promise<FileDiff[]>;
    postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
    upsertComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
}
export declare const SCHEMA_WATCHER_COMMENT_MARKER = "<!-- crew-schema-watcher -->";
type OctokitLike = {
    rest: {
        pulls: {
            listFiles(params: {
                owner: string;
                repo: string;
                pull_number: number;
                per_page?: number;
                page?: number;
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
            listComments(params: {
                owner: string;
                repo: string;
                issue_number: number;
                per_page?: number;
                page?: number;
            }): Promise<{
                data: Array<{
                    id: number;
                    body?: string | null;
                    user?: {
                        login?: string | null;
                    } | null;
                }>;
            }>;
            updateComment(params: {
                owner: string;
                repo: string;
                comment_id: number;
                body: string;
            }): Promise<unknown>;
            deleteComment?(params: {
                owner: string;
                repo: string;
                comment_id: number;
            }): Promise<unknown>;
        };
    };
};
export declare function createGitHubClientWithOctokit(octokit: OctokitLike): GitHubClient;
export declare function createGitHubClient(token: string): GitHubClient;
export declare function parseGitHubDiff(diffContent: string): FileDiff[];
export {};
//# sourceMappingURL=github.d.ts.map