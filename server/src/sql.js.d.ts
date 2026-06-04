declare module 'sql.js' {
  interface SqlJsStatic {
    Database: typeof Database;
  }

  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    get(params?: unknown[]): unknown[];
    getColumnNames(): string[];
    getAsObject(params?: unknown[]): Record<string, unknown>;
    free(): boolean;
    reset(): void;
    run(params?: unknown[]): void;
  }

  class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export type { Database, Statement, QueryExecResult, SqlJsStatic };
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
