import { describe, it, expect, vi } from 'vitest';

describe('CLI', () => {
  it('should export parseArgs function', async () => {
    const { parseArgs } = await import('../src/index');
    expect(typeof parseArgs).toBe('function');
  });

  it('posts changes to API when api key is provided', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: false,
      init: false,
    }, { postSchemaChanges });

    expect(postSchemaChanges).toHaveBeenCalledWith({
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 42,
      changes: [],
    });
  });

  it('does not post changes in dry-run mode', async () => {
    const { runSchemaWatcher } = await import('../src/index');
    const postSchemaChanges = vi.fn().mockResolvedValue(undefined);

    await runSchemaWatcher({
      repo: 'test/repo',
      pr: 42,
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      dryRun: true,
      init: false,
    }, { postSchemaChanges });

    expect(postSchemaChanges).not.toHaveBeenCalled();
  });
});
