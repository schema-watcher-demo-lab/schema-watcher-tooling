import { describe, expect, it, vi } from "vitest";
import { createGitHubClientWithOctokit, parseGitHubDiff } from "../src/github";

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
        issues: { createComment: vi.fn() },
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
