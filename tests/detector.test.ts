import { describe, it, expect } from 'vitest';
import { isSchemaFile } from '../src/detector';

describe('detector', () => {
  it('should detect Prisma schema', () => {
    expect(isSchemaFile('schema.prisma')).toBe(true);
    expect(isSchemaFile('db/schema.prisma')).toBe(true);
  });

  it('should detect dbt models', () => {
    expect(isSchemaFile('models/schema.yml')).toBe(true);
    expect(isSchemaFile('models/users.sql')).toBe(true);
  });

  it('should detect migration files', () => {
    expect(isSchemaFile('migrations/001_create_users.sql')).toBe(true);
    expect(isSchemaFile('db/migrations/20240101_create_users.py')).toBe(true);
  });

  it('should reject non-schema files', () => {
    expect(isSchemaFile('src/index.ts')).toBe(false);
    expect(isSchemaFile('README.md')).toBe(false);
  });
});
