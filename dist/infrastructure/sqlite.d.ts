import { DatabaseSync, type StatementSync } from "node:sqlite";
export declare class DurableSqlite {
    readonly path: string;
    readonly database: DatabaseSync;
    private closed;
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    transaction<T>(operation: () => T): T;
    close(): void;
    private assertOpen;
}
export declare function asNumber(value: unknown): number;
//# sourceMappingURL=sqlite.d.ts.map