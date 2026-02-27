export type ChangeType = 
  | 'TABLE_ADDED'
  | 'TABLE_REMOVED'
  | 'COLUMN_ADDED'
  | 'COLUMN_REMOVED'
  | 'COLUMN_TYPE_CHANGED'
  | 'COLUMN_NULLABLE_CHANGED'
  | 'COLUMN_DEFAULT_CHANGED';

export interface ColumnChange {
  column: string;
  changeType: ChangeType;
  oldType?: string;
  newType?: string;
  oldNullable?: boolean;
  newNullable?: boolean;
  oldDefault?: string;
  newDefault?: string;
}

export interface TableSchema {
  name: string;
  columns: Record<string, {
    type: string;
    nullable: boolean;
    default?: string;
  }>;
}

export interface SchemaChange {
  table: string;
  changeType: ChangeType;
  column?: string;
  oldType?: string;
  newType?: string;
  oldNullable?: boolean;
  newNullable?: boolean;
  oldDefault?: string;
  newDefault?: string;
}

export interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  status: 'added' | 'modified' | 'deleted';
}

export interface Reporter {
  report(changes: SchemaChange[]): Promise<void>;
}

export interface SchemaParser {
  parse(content: string): TableSchema[];
}
