import { describe, it, expect, vi, afterEach } from 'vitest';
import { postSchemaChanges, setLookupForTests } from "../src/api";

describe('api client', () => {
  const originalFetch = globalThis.fetch;
  const originalAllowPrivate = process.env.ALLOW_PRIVATE_API_ENDPOINTS;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    setLookupForTests(null);
    process.env.ALLOW_PRIVATE_API_ENDPOINTS = originalAllowPrivate;
  });

  it('posts schema changes with expected payload and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ch_1', repositoryId: 'repo_1', organizationId: 'org_1', pr: 123, changes: '[]', status: 'detected', isBreaking: false, createdAt: '2026-03-06T00:00:00Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    setLookupForTests(async () => [
      { address: "93.184.216.34" },
    ]);
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

    setLookupForTests(async () => [
      { address: "93.184.216.34" },
    ]);
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
    setLookupForTests(async () => [
      { address: "93.184.216.34" },
    ]);
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

  it('rejects link-local and unique-local endpoint hosts', async () => {
    setLookupForTests(async () => [
      { address: "93.184.216.34" },
    ]);
    await expect(
      postSchemaChanges({
        apiEndpoint: 'http://169.254.169.254',
        apiKey: 'k',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Disallowed private API endpoint host: 169.254.169.254');

    await expect(
      postSchemaChanges({
        apiEndpoint: 'http://[fd00::1]',
        apiKey: 'k',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Disallowed private API endpoint host: [fd00::1]');

    await expect(
      postSchemaChanges({
        apiEndpoint: 'http://100.64.0.1',
        apiKey: 'k',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Disallowed private API endpoint host: 100.64.0.1');
  });

  it('rejects insecure http for public API endpoints', async () => {
    setLookupForTests(async () => [
      { address: "93.184.216.34" },
    ]);
    await expect(
      postSchemaChanges({
        apiEndpoint: 'http://api.example.com',
        apiKey: 'k',
        repo: 'test/repo',
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow('Insecure API endpoint protocol: http (use https)');
  });

  it('allows private http endpoint when ALLOW_PRIVATE_API_ENDPOINTS=1', async () => {
    process.env.ALLOW_PRIVATE_API_ENDPOINTS = '1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ch_1', repositoryId: 'repo_1', organizationId: 'org_1', pr: 1, changes: '[]', status: 'detected', isBreaking: false, createdAt: '2026-03-06T00:00:00Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    setLookupForTests(async () => [
      { address: "127.0.0.1" },
    ]);
    await postSchemaChanges({
      apiEndpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 1,
      changes: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/changes');
  });

  it('includes event field in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ch_1', repositoryId: 'repo_1', organizationId: 'org_1', pr: 1, changes: '[]', status: 'detected', isBreaking: false, createdAt: '2026-03-06T00:00:00Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    setLookupForTests(async () => [{ address: '93.184.216.34' }]);
    await postSchemaChanges({
      apiEndpoint: 'https://api.example.com',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 123,
      changes: [],
      event: 'pr',
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.event).toBe('pr');
  });

  it('returns synthetic result for 204 close response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    setLookupForTests(async () => [{ address: '93.184.216.34' }]);
    const result = await postSchemaChanges({
      apiEndpoint: 'https://api.example.com',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 42,
      changes: [],
      event: 'close',
    });

    expect(result.status).toBe('closed');
    expect(result.pr).toBe(42);
    expect(result.id).toBe('');
  });

  it('sends request without event field when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ch_1', repositoryId: 'repo_1', organizationId: 'org_1', pr: 1, changes: '[]', status: 'detected', isBreaking: false, createdAt: '2026-03-06T00:00:00Z' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    setLookupForTests(async () => [{ address: '93.184.216.34' }]);
    await postSchemaChanges({
      apiEndpoint: 'https://api.example.com',
      apiKey: 'test-api-key',
      repo: 'test/repo',
      pr: 1,
      changes: [],
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.event).toBeUndefined();
  });

  it('rejects domains that resolve to private addresses', async () => {
    setLookupForTests(async () => [
      { address: "10.0.0.5" },
    ]);
    await expect(
      postSchemaChanges({
        apiEndpoint: "https://api.example.com",
        apiKey: "k",
        repo: "test/repo",
        pr: 1,
        changes: [],
      })
    ).rejects.toThrow("Disallowed private resolved address for host api.example.com: 10.0.0.5");
  });
});
