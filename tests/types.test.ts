import { describe, it, expect } from 'vitest';
import { SchemaChange } from '../src/types';

describe('types', () => {
  it('should export SchemaChange interface', () => {
    const change: SchemaChange = {
      table: 'users',
      changeType: 'COLUMN_ADDED',
      column: 'email',
      oldType: undefined,
      newType: 'string',
    };
    expect(change.changeType).toBe('COLUMN_ADDED');
  });
});
