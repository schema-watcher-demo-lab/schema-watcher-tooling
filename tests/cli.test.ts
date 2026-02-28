import { describe, it, expect, vi } from 'vitest';

describe('CLI', () => {
  it('should export parseArgs function', async () => {
    const { parseArgs } = await import('../src/index');
    expect(typeof parseArgs).toBe('function');
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
});
