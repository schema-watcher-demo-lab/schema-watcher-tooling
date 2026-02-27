import { describe, it, expect } from 'vitest';

describe('CLI', () => {
  it('should export parseArgs function', async () => {
    const { parseArgs } = await import('../src/index');
    expect(typeof parseArgs).toBe('function');
  });
});
