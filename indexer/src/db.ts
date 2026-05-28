import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { EventQueryParams, IndexedEvent } from "./types";

const DB_PATH =
  process.env.INDEXER_DB_PATH ??
  path.join(process.cwd(), "vestflow-events.db");

const SCHEMA_PATH = path.join(__dirname, "..", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    // WAL mode: safe concurrent reads from the query server while the
    // poller writes, without blocking either side.
    _db.pragma("journal_mode = WAL");
    _db.pragma("synchronous = NORMAL");
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    _db.exec(schema);
  }
  return _db;
}

// ── Checkpoint ────────────────────────────────────────────────────────

export function getCheckpoint(): number {
  const row = getDb()
    .prepare("SELECT last_ledger FROM checkpoint WHERE id = 1")
    .get() as { last_ledger: number } | undefined;
  return row?.last_ledger ?? 0;
}

export function setCheckpoint(ledger: number): void {
  getDb()
    .prepare("UPDATE checkpoint SET last_ledger = ? WHERE id = 1")
    .run(ledger);
}

// ── Events ────────────────────────────────────────────────────────────

export interface InsertEventRow {
  id: string;
  event_type: string;
  ledger: number;
  ledger_closed_at: string;
  schedule_id: number | null;
  grantor: string | null;
  beneficiary: string | null;
  amount: string | null;
  raw_topics: string;
  raw_value: string;
}

/**
 * Inserts an event row.
 * Returns true if a new row was written, false if it already existed
 * (idempotent — duplicate Stellar event IDs are silently ignored).
 */
export function insertEvent(row: InsertEventRow): boolean {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO schedule_events
        (id, event_type, ledger, ledger_closed_at, schedule_id,
         grantor, beneficiary, amount, raw_topics, raw_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.id,
      row.event_type,
      row.ledger,
      row.ledger_closed_at,
      row.schedule_id,
      row.grantor,
      row.beneficiary,
      row.amount,
      row.raw_topics,
      row.raw_value
    );
  return result.changes > 0;
}

/** Query events with optional filters. Results ordered by ledger DESC. */
export function queryEvents(params: EventQueryParams): IndexedEvent[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.address) {
    conditions.push("(grantor = ? OR beneficiary = ?)");
    values.push(params.address, params.address);
  }
  if (params.grantor) {
    conditions.push("grantor = ?");
    values.push(params.grantor);
  }
  if (params.beneficiary) {
    conditions.push("beneficiary = ?");
    values.push(params.beneficiary);
  }
  if (params.event_type) {
    conditions.push("event_type = ?");
    values.push(params.event_type);
  }
  if (params.schedule_id != null) {
    conditions.push("schedule_id = ?");
    values.push(params.schedule_id);
  }
  if (params.from_ledger != null) {
    conditions.push("ledger >= ?");
    values.push(params.from_ledger);
  }
  if (params.to_ledger != null) {
    conditions.push("ledger <= ?");
    values.push(params.to_ledger);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  return getDb()
    .prepare(
      `SELECT * FROM schedule_events ${where} ORDER BY ledger DESC LIMIT ? OFFSET ?`
    )
    .all(...values, limit, offset) as IndexedEvent[];
}