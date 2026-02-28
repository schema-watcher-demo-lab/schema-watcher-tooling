export declare function isSchemaFile(filePath: string): boolean;
export interface FileChange {
    filePath: string;
    status: 'added' | 'modified' | 'deleted';
    additions: number;
    deletions: number;
}
export declare function detectSchemaFiles(changes: FileChange[]): FileChange[];
//# sourceMappingURL=detector.d.ts.map