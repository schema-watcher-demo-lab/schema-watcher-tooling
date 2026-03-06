import { describe, expect, it, vi } from "vitest";
import {
  SCHEMA_WATCHER_COMMENT_MARKER,
  createGitHubClientWithOctokit,
  parseGitHubDiff,
} from "../src/github";

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

describe("github client", () => {
  it("fetches actual old/new file content for PR files", async () => {
    const listFiles = vi.fn().mockResolvedValue({
      data: [
        { filename: "added.sql", status: "added" },
        { filename: "changed.sql", status: "modified" },
        { filename: "removed.sql", status: "deleted" },
      ],
    });
    const getPull = vi.fn().mockResolvedValue({
      data: { base: { sha: "base-sha" }, head: { sha: "head-sha" } },
    });
    const getContent = vi.fn().mockImplementation(({ path, ref }: { path: string; ref: string }) => {
      const contentMap: Record<string, string> = {
        "added.sql@head-sha": "create table added(id int);",
        "changed.sql@base-sha": "create table changed(id int);",
        "changed.sql@head-sha": "create table changed(id bigint);",
        "removed.sql@base-sha": "create table removed(id int);",
      };
      return Promise.resolve({
        data: { content: b64(contentMap[`${path}@${ref}`] || ""), encoding: "base64" },
      });
    });

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles, get: getPull },
        repos: { getContent },
        issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
      },
    });

    const diffs = await client.getPRDiffs("acme", "repo", 42);

    expect(diffs).toEqual([
      {
        filePath: "added.sql",
        oldContent: "",
        newContent: "create table added(id int);",
        status: "added",
      },
      {
        filePath: "changed.sql",
        oldContent: "create table changed(id int);",
        newContent: "create table changed(id bigint);",
        status: "modified",
      },
      {
        filePath: "removed.sql",
        oldContent: "create table removed(id int);",
        newContent: "",
        status: "deleted",
      },
    ]);
  });

  it("processes all PR files across paginated listFiles responses", async () => {
    const listFiles = vi.fn().mockImplementation(({ page }: { page?: number }) => {
      if (page === 2) {
        return Promise.resolve({
          data: [{ filename: "second-page.sql", status: "added" }],
        });
      }
      return Promise.resolve({
        data: Array.from({ length: 100 }, (_, index) => ({
          filename: index === 0 ? "first-page.sql" : `filler-${index}.sql`,
          status: "added",
        })),
      });
    });
    const getPull = vi.fn().mockResolvedValue({
      data: { base: { sha: "base-sha" }, head: { sha: "head-sha" } },
    });
    const getContent = vi.fn().mockImplementation(({ path }: { path: string }) =>
      Promise.resolve({ data: { content: b64(`content:${path}`), encoding: "base64" } })
    );

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles, get: getPull },
        repos: { getContent },
        issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
      },
    });

    const diffs = await client.getPRDiffs("acme", "repo", 42);

    expect(diffs).toHaveLength(101);
    expect(diffs[0]).toEqual({
      filePath: "first-page.sql",
      oldContent: "",
      newContent: "content:first-page.sql",
      status: "added",
    });
    expect(diffs[100]).toEqual({
      filePath: "second-page.sql",
      oldContent: "",
      newContent: "content:second-page.sql",
      status: "added",
    });
  });

  it("creates comment when marker comment does not exist", async () => {
    const listComments = vi.fn().mockResolvedValue({
      data: [{ id: 1001, body: "Looks good" }],
    });
    const createComment = vi.fn().mockResolvedValue({});
    const updateComment = vi.fn().mockResolvedValue({});

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles: vi.fn(), get: vi.fn() },
        repos: { getContent: vi.fn() },
        issues: { createComment, listComments, updateComment },
      },
    });

    await client.upsertComment("acme", "repo", 42, "Schema drift detected");

    expect(listComments).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      issue_number: 42,
      per_page: 100,
      page: 1,
    });
    expect(updateComment).not.toHaveBeenCalled();
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(createComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      issue_number: 42,
      body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nSchema drift detected`,
    });
  });

  it("updates existing marker comment when present", async () => {
    const listComments = vi.fn().mockResolvedValue({
      data: [
        { id: 1001, body: "A normal review comment" },
        { id: 1002, body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nold watcher output` },
      ],
    });
    const createComment = vi.fn().mockResolvedValue({});
    const updateComment = vi.fn().mockResolvedValue({});

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles: vi.fn(), get: vi.fn() },
        repos: { getContent: vi.fn() },
        issues: { createComment, listComments, updateComment },
      },
    });

    await client.upsertComment("acme", "repo", 42, "New watcher output");

    expect(listComments).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      issue_number: 42,
      per_page: 100,
      page: 1,
    });
    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(updateComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      comment_id: 1002,
      body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nNew watcher output`,
    });
  });

  it("ignores unrelated comments and updates first marker comment", async () => {
    const listComments = vi.fn().mockResolvedValue({
      data: [
        { id: 3001, body: "No marker here" },
        { id: 3002, body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nfirst marker` },
        { id: 3003, body: "Another unrelated comment" },
        { id: 3004, body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nsecond marker` },
      ],
    });
    const createComment = vi.fn().mockResolvedValue({});
    const updateComment = vi.fn().mockResolvedValue({});

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles: vi.fn(), get: vi.fn() },
        repos: { getContent: vi.fn() },
        issues: { createComment, listComments, updateComment },
      },
    });

    await client.upsertComment("acme", "repo", 42, "Newest watcher output");

    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(updateComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      comment_id: 3002,
      body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nNewest watcher output`,
    });
  });

  it("finds marker comment on later paginated comments pages", async () => {
    const listComments = vi.fn().mockImplementation(({ page }: { page?: number }) => {
      if (page === 2) {
        return Promise.resolve({
          data: [{ id: 5002, body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nolder watcher output` }],
        });
      }
      return Promise.resolve({
        data: Array.from({ length: 100 }, (_, index) => ({
          id: 5001 + index,
          body: `Unrelated comment ${index}`,
        })),
      });
    });
    const createComment = vi.fn().mockResolvedValue({});
    const updateComment = vi.fn().mockResolvedValue({});

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles: vi.fn(), get: vi.fn() },
        repos: { getContent: vi.fn() },
        issues: { createComment, listComments, updateComment },
      },
    });

    await client.upsertComment("acme", "repo", 42, "Updated watcher output");

    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      comment_id: 5002,
      body: `${SCHEMA_WATCHER_COMMENT_MARKER}\nUpdated watcher output`,
    });
  });

  it("treats 404 content fetch as empty but propagates non-404 errors", async () => {
    const listFiles = vi.fn().mockResolvedValue({
      data: [
        { filename: "missing.sql", status: "added" },
        { filename: "boom.sql", status: "added" },
      ],
    });
    const getPull = vi.fn().mockResolvedValue({
      data: { base: { sha: "base-sha" }, head: { sha: "head-sha" } },
    });
    const getContent = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === "missing.sql") {
        return Promise.reject({ status: 404 });
      }
      if (path === "boom.sql") {
        return Promise.reject({ status: 500, message: "server exploded" });
      }
      return Promise.resolve({ data: { content: b64("ok"), encoding: "base64" } });
    });

    const client = createGitHubClientWithOctokit({
      rest: {
        pulls: { listFiles, get: getPull },
        repos: { getContent },
        issues: { createComment: vi.fn(), listComments: vi.fn(), updateComment: vi.fn() },
      },
    });

    await expect(client.getPRDiffs("acme", "repo", 42)).rejects.toMatchObject({ status: 500 });
  });
});

describe("parseGitHubDiff", () => {
  it("reconstructs old and new content from unified diff hunks", () => {
    const diff = [
      "diff --git a/schema.sql b/schema.sql",
      "index 1111111..2222222 100644",
      "--- a/schema.sql",
      "+++ b/schema.sql",
      "@@ -1,2 +1,3 @@",
      " CREATE TABLE users (",
      "-  id INT",
      "+  id BIGINT,",
      "+  email TEXT",
      " );",
      "",
    ].join("\n");

    expect(parseGitHubDiff(diff)).toEqual([
      {
        filePath: "schema.sql",
        oldContent: "CREATE TABLE users (\n  id INT\n);",
        newContent: "CREATE TABLE users (\n  id BIGINT,\n  email TEXT\n);",
        status: "modified",
      },
    ]);
  });
});
