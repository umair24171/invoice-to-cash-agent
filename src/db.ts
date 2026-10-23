import pg from "pg";
export interface Query {
  query<T extends Record<string, any> = Record<string, any>>(
    sql: string,
    args?: any[],
  ): Promise<T[]>;
}
export interface Database extends Query {
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const wrap = (c: pg.Pool | pg.PoolClient): Query => ({
      query: async (sql, args) => (await c.query(sql, args)).rows,
    });
    return {
      ...wrap(pool),
      tx: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const v = await fn(wrap(c));
          await c.query("COMMIT");
          return v;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (process.env.TEST_PGLITE !== "1")
    throw new Error(
      "Set DATABASE_URL; TEST_PGLITE=1 is supplemental testing only",
    );
  const { PGlite } = await import("@electric-sql/pglite");
  const p = new PGlite(process.env.PGLITE_PATH);
  const wrap = (c: any): Query => ({
    query: async (sql, args) => (await c.query(sql, args)).rows,
  });
  return {
    ...wrap(p),
    tx: (fn) => p.transaction((c) => fn(wrap(c))),
    close: () => p.close(),
  };
}
