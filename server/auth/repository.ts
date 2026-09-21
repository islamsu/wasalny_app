import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { mysqlConnectionOptions } from "../_core/mysql-config";
let pool: Pool | undefined;
export async function transaction<T>(work: (c: PoolConnection) => Promise<T>) {
  pool ??= mysql.createPool({ ...mysqlConnectionOptions(), timezone: "Z", connectionLimit: 8 });
  const c = await pool.getConnection();
  try { await c.query("SET time_zone = '+00:00'"); await c.beginTransaction(); const result = await work(c); await c.commit(); return result; }
  catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}
export async function rows(c: PoolConnection, sql: string, args: unknown[] = []) {
  const [result] = await c.execute<RowDataPacket[]>(sql, args);
  return result;
}
export async function write(c: PoolConnection, sql: string, args: unknown[] = []) {
  const [result] = await c.execute<ResultSetHeader>(sql, args);
  return result;
}