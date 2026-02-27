const SCHEMA_PATTERNS = [
  /\.prisma$/,
  /(^|\/)drizzle\/.*\.(ts|js)$/,
  /(^|\/)schemas\/.*\.(avsc|proto|schema\.json)$/,
  /(^|\/)metrics\/contracts\.(yml|yaml)$/,
  /(^|\/)logs_traces\/contracts\.(yml|yaml)$/,
  /\/dbt\/models\//,
  /\/dbt\/schemas\//,
  /models\/.*\.(yml|yaml|sql)$/,
  /(^|\/)migrations?\//,
  /\/db\/migrations?\//,
  /\/db\/migrate\//,
  /\/migrate\//,
  /\/models\.py$/,
  /\/entities\/.*\.ts$/,
];

export function isSchemaFile(filePath: string): boolean {
  return SCHEMA_PATTERNS.some(pattern => pattern.test(filePath));
}

export interface FileChange {
  filePath: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

export function detectSchemaFiles(changes: FileChange[]): FileChange[] {
  return changes.filter(change => isSchemaFile(change.filePath));
}
