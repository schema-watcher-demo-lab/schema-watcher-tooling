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
      dryRun: false,
      init: false,
    }, { postSchemaChanges, detectChanges });

    expect(postSchemaChanges).toHaveBeenCalledWith({
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 42,
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
});
