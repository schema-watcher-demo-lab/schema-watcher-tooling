import { describe, it, expect, vi } from 'vitest';

describe('CLI', () => {
  it('should export parseArgs function', async () => {
    const { parseArgs } = await import('../src/index');
    expect(typeof parseArgs).toBe('function');
  });

  it('fails fast when --pr is not a valid integer', async () => {
    const { parseArgs } = await import('../src/index');

    expect(() => parseArgs([
      'node',
      'crew-schema-watcher',
      '--repo',
      'test/repo',
      '--pr',
      'abc',
    ])).toThrow('--pr must be a positive integer');
  });

  it('posts changes to API when api key is provided', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([
      { table: 'products', changeType: 'COLUMN_ADDED', column: 'currency', newType: 'text' },
    ]);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      organizationId: 'org_mock_repos',
      dryRun: false,
      init: false,
    }, { postSchemaChanges, detectChanges });

    expect(postSchemaChanges).toHaveBeenCalledWith({
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 42,
      organizationId: 'org_mock_repos',
      changes: [
        { table: 'products', changeType: 'COLUMN_ADDED', column: 'currency', newType: 'text' },
      ],
    });
  });

  it('does not post changes in dry-run mode', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([]);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: true,
      init: false,
    }, { postSchemaChanges, detectChanges });

    expect(postSchemaChanges).not.toHaveBeenCalled();
  });

  it('does not post changes when no schema changes are detected', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([]);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: false,
      init: false,
    }, { postSchemaChanges, detectChanges });

    expect(postSchemaChanges).not.toHaveBeenCalled();
  });

  it('runs init mode using full schema-file scan', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([
      { table: 'users', changeType: 'TABLE_ADDED' },
    ]);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: false,
      init: true,
    }, { postSchemaChanges, detectChanges });

    expect(detectChanges).toHaveBeenCalledWith({ includeAllFiles: true });
    expect(postSchemaChanges).toHaveBeenCalledTimes(1);
  });

  it('reports to slack and kafka when configured', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([{ table: 'users', changeType: 'TABLE_ADDED' }]);
    const reportSlack = vi.fn().mockResolvedValue(undefined);
    const reportKafka = vi.fn().mockResolvedValue(undefined);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: false,
      init: false,
      slackWebhook: 'https://hooks.slack.com/services/T000/B000/X',
      kafkaBroker: 'kafka:9092',
      kafkaTopic: 'schema-events',
    }, { postSchemaChanges, detectChanges, reportSlack, reportKafka });

    expect(reportSlack).toHaveBeenCalledTimes(1);
    expect(reportKafka).toHaveBeenCalledTimes(1);
  });

  it('upserts a GitHub PR comment when token exists and changes are detected', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-github-token';

    try {
      const { runSchemaWatcher } = await import('../src/index');
      const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
      const detectChanges = vi.fn().mockReturnValue([
        { table: 'products', changeType: 'COLUMN_ADDED', column: 'currency', newType: 'text' },
      ]);
      const reportGitHubComment = vi.fn().mockResolvedValue(undefined);
      const deps = {
        postSchemaChanges,
        detectChanges,
        reportGitHubComment,
      } as Parameters<typeof runSchemaWatcher>[1];

      await runSchemaWatcher({
        repo: 'test/repo',
        pr: 42,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, deps);

      expect(reportGitHubComment).toHaveBeenCalledTimes(1);
      expect(reportGitHubComment).toHaveBeenCalledWith(
        expect.objectContaining({ repo: 'test/repo', pr: 42 }),
        [
          { table: 'products', changeType: 'COLUMN_ADDED', column: 'currency', newType: 'text' },
        ]
      );
    } finally {
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }
    }
  });

  it('builds GitHub comment payload with single marker, watcher heading, and summary lines', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-github-token';

    try {
      const { reportGitHubCommentDefault } = await import('../src/index');
      const upsertComment = vi.fn().mockResolvedValue(undefined);
      const createGitHubClient = vi.fn().mockReturnValue({ upsertComment });

      await reportGitHubCommentDefault({
        repo: 'owner/repo',
        pr: 77,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, [
        { table: 'products', changeType: 'COLUMN_ADDED', column: 'currency', newType: 'text' },
        { table: 'orders', changeType: 'TABLE_ADDED' },
      ], createGitHubClient);

      const payload = upsertComment.mock.calls[0]?.[3] as string;
      const markerOccurrences = (payload.match(/<!-- crew-schema-watcher -->/g) ?? []).length;
      expect(markerOccurrences).toBe(1);
      expect(upsertComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        77,
        expect.stringContaining('## Crew Schema Watcher')
      );
      expect(upsertComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        77,
        expect.stringContaining('- `products`: COLUMN_ADDED (`currency`)')
      );
      expect(upsertComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        77,
        expect.stringContaining('- `orders`: TABLE_ADDED')
      );
    } finally {
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }
    }
  });

  it('skips GitHub PR comment upsert when token is missing', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    try {
      const { runSchemaWatcher } = await import('../src/index');
      const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
      const detectChanges = vi.fn().mockReturnValue([{ table: 'users', changeType: 'TABLE_ADDED' }]);
      const reportGitHubComment = vi.fn().mockResolvedValue(undefined);
      const deps = {
        postSchemaChanges,
        detectChanges,
        reportGitHubComment,
      } as Parameters<typeof runSchemaWatcher>[1];

      await runSchemaWatcher({
        repo: 'test/repo',
        pr: 42,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, deps);

      expect(reportGitHubComment).not.toHaveBeenCalled();
    } finally {
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }
    }
  });

  it('skips GitHub PR comment upsert on non-pull_request events', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    const previousEventName = process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.GITHUB_EVENT_NAME = 'push';

    try {
      const { runSchemaWatcher } = await import('../src/index');
      const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
      const detectChanges = vi.fn().mockReturnValue([{ table: 'users', changeType: 'TABLE_ADDED' }]);
      const reportGitHubComment = vi.fn().mockResolvedValue(undefined);
      const deps = {
        postSchemaChanges,
        detectChanges,
        reportGitHubComment,
      } as Parameters<typeof runSchemaWatcher>[1];

      await runSchemaWatcher({
        repo: 'test/repo',
        pr: 42,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, deps);

      expect(reportGitHubComment).not.toHaveBeenCalled();
    } finally {
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }

      if (previousEventName === undefined) {
        delete process.env.GITHUB_EVENT_NAME;
      } else {
        process.env.GITHUB_EVENT_NAME = previousEventName;
      }
    }
  });

  it('warns and continues when GitHub PR comment upsert fails', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-github-token';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { runSchemaWatcher } = await import('../src/index');
      const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
      const detectChanges = vi.fn().mockReturnValue([{ table: 'users', changeType: 'TABLE_ADDED' }]);
      const reportGitHubComment = vi.fn().mockImplementation(async () => {
        throw new Error('boom');
      });
      const deps = {
        postSchemaChanges,
        detectChanges,
        reportGitHubComment,
      } as Parameters<typeof runSchemaWatcher>[1];

      await expect(runSchemaWatcher({
        repo: 'test/repo',
        pr: 42,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, deps)).resolves.toBeUndefined();

      expect(postSchemaChanges).toHaveBeenCalledTimes(1);
      expect(reportGitHubComment).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('GitHub comment reporting failed:', 'boom');
    } finally {
      warnSpy.mockRestore();
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }
    }
  });

  it('warns and skips upsert when repo format is invalid for GitHub reporting', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'test-github-token';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { runSchemaWatcher, reportGitHubCommentDefault } = await import('../src/index');
      const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
      const detectChanges = vi.fn().mockReturnValue([{ table: 'users', changeType: 'TABLE_ADDED' }]);
      const upsertComment = vi.fn().mockResolvedValue(undefined);
      const createGitHubClient = vi.fn().mockReturnValue({ upsertComment });
      const reportGitHubComment = (
        args: Parameters<typeof reportGitHubCommentDefault>[0],
        changes: Parameters<typeof reportGitHubCommentDefault>[1],
      ) => reportGitHubCommentDefault(args, changes, createGitHubClient);

      await expect(runSchemaWatcher({
        repo: 'owner/repo/extra',
        pr: 42,
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, {
        postSchemaChanges,
        detectChanges,
        reportGitHubComment,
      })).resolves.toBeUndefined();

      expect(createGitHubClient).not.toHaveBeenCalled();
      expect(upsertComment).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'GitHub comment reporting failed:',
        'Invalid repo format: owner/repo/extra. Expected owner/name'
      );
    } finally {
      warnSpy.mockRestore();
      if (previousToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousToken;
      }
    }
  });

  it('requires api endpoint when api reporting is enabled', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);
    const detectChanges = vi.fn().mockReturnValue([]);

    await expect(
      runSchemaWatcher({
        repo: 'test/repo',
        pr: 42,
        apiEndpoint: '',
        apiKey: 'test-api-key',
        dryRun: false,
        init: false,
      }, { postSchemaChanges, detectChanges })
    ).rejects.toThrow('--api-endpoint (or SCHEMA_API_ENDPOINT) is required when API reporting is enabled');
  });
});
