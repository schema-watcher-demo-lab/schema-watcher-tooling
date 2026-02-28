import { describe, it, expect, vi, afterEach } from 'vitest';

describe('api client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('posts schema changes with expected payload and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { postSchemaChanges } = await import('../src/api');
    await postSchemaChanges({
      apiEndpoint: 'https://api.example.com',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 123,
      organizationId: 'org_mock_repos',
      changes: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/changes');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'test-api-key',
    });
    expect(options.body).toBe(JSON.stringify({
      repo: 'test/repo',
      pr: 123,
      organizationId: 'org_mock_repos',
      changes: [],
    }));
  });

  it('throws on non-2xx api response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { postSchemaChanges } = await import('../src/api');
    await expect(
      postSchemaChanges({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'bad-key',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Schema API request failed (401): Invalid API key');
  });

  it('rejects private API endpoints', async () => {
    const { postSchemaChanges } = await import('../src/api');
    await expect(
      postSchemaChanges({
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'k',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Disallowed private API endpoint host: localhost');
  });
});
