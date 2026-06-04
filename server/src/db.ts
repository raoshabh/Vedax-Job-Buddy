import initSqlJs, { type Database } from 'sql.js';
type SqlJsDatabase = Database;
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type {
  User,
  Profile,
  Job,
  Application,
  DashboardStats,
  Activity,
  WhatsappPrefs,
  DailyDigest,
  AutoApplyConfig,
  AutoApplyRun,
  Subscription,
} from './types.js';
import type { NormalizedJob } from './jobs/types.js';
import { scoreJob } from './jobs/match.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'jobtracker.db');

let dbInstance: SqlJsDatabase | null = null;

function saveDb(): void {
  if (dbInstance) {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export async function initDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run('PRAGMA journal_mode = WAL');
  dbInstance.run('PRAGMA foreign_keys = ON');
  initTables(dbInstance);
  saveDb();

  return dbInstance;
}

export function getDb(): SqlJsDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

function initTables(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      cities TEXT NOT NULL DEFAULT '[]',
      salary_min INTEGER NOT NULL DEFAULT 0,
      salary_max INTEGER NOT NULL DEFAULT 0,
      experience_years INTEGER NOT NULL DEFAULT 0,
      skills TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      resume_path TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      salary_min INTEGER NOT NULL DEFAULT 0,
      salary_max INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      remote INTEGER NOT NULL DEFAULT 0,
      employment_type TEXT NOT NULL DEFAULT '',
      match_score REAL NOT NULL DEFAULT 0,
      posted_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      applied_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_prefs (
      user_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL DEFAULT '',
      opted_in INTEGER NOT NULL DEFAULT 0,
      digest_hour INTEGER NOT NULL DEFAULT 20,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      last_sent_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tailorings (
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      data TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, job_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS interview_preps (
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      data TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, job_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS auto_apply_config (
      user_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'prepare',
      daily_cap INTEGER NOT NULL DEFAULT 10,
      min_score INTEGER NOT NULL DEFAULT 65,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS auto_apply_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      requested INTEGER NOT NULL DEFAULT 0,
      prepared INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      summary TEXT,
      started_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT,
      provider TEXT NOT NULL DEFAULT 'mock',
      provider_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  migrateJobsTable(db);

  // One-time cleanup: purge legacy mock jobs from the prototype. Every real
  // ingested job carries an external_id, so NULL rows are pre-migration mocks.
  // (Cascades to their throwaway test applications via the FK.)
  db.run("DELETE FROM jobs WHERE external_id IS NULL");

  // Dedupe key for ingested jobs (NULL external_id rows remain distinct).
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_ext ON jobs(source, external_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_at)');
}

/** Additive migration: add columns introduced after the first release. */
function migrateJobsTable(db: SqlJsDatabase): void {
  const cols = new Set<string>();
  const stmt = db.prepare('PRAGMA table_info(jobs)');
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string };
    if (row.name) cols.add(row.name);
  }
  stmt.free();

  const additions: Array<[string, string]> = [
    ['external_id', 'ALTER TABLE jobs ADD COLUMN external_id TEXT'],
    ['remote', 'ALTER TABLE jobs ADD COLUMN remote INTEGER NOT NULL DEFAULT 0'],
    ['employment_type', "ALTER TABLE jobs ADD COLUMN employment_type TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [col, sql] of additions) {
    if (!cols.has(col)) db.run(sql);
  }
}

// Helper to run a query and get one row as an object
function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params.map(p => p === undefined ? null : p));
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]] = vals[i];
    }
    return row as T;
  }
  stmt.free();
  return undefined;
}

// Helper to run a query and get all rows as objects
function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params.map(p => p === undefined ? null : p));
  const results: T[] = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]] = vals[i];
    }
    results.push(row as T);
  }
  stmt.free();
  return results;
}

// Helper to execute a write statement
function execute(sql: string, params: unknown[] = []): void {
  const db = getDb();
  db.run(sql, params.map(p => p === undefined ? null : p));
  saveDb();
}

// ── User helpers ──

export function getUser(emailOrId: string): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE email = ? OR id = ?', [emailOrId, emailOrId]);
}

export function createUser(email: string, name: string, passwordHash: string): User {
  const id = uuidv4();
  const created_at = new Date().toISOString();
  execute(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, email, name, passwordHash, created_at]
  );
  return { id, email, name, password_hash: passwordHash, created_at };
}

// ── Profile helpers ──

export function getProfile(userId: string): Profile | undefined {
  return queryOne<Profile>('SELECT * FROM profiles WHERE user_id = ?', [userId]);
}

export function upsertProfile(userId: string, data: Partial<Omit<Profile, 'user_id'>>): Profile {
  const existing = getProfile(userId);

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length > 0) {
      values.push(userId);
      execute(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, values);
    }
  } else {
    const cols = ['user_id', ...Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined)];
    const vals: unknown[] = [userId, ...Object.values(data).filter(v => v !== undefined)];
    const placeholders = cols.map(() => '?').join(', ');
    execute(`INSERT INTO profiles (${cols.join(', ')}) VALUES (${placeholders})`, vals);
  }

  return getProfile(userId)!;
}

// ── Job helpers ──

/**
 * Bulk-insert ingested jobs, skipping duplicates via the (source, external_id)
 * unique index. Returns the number of NEW rows inserted. Saves once at the end.
 */
export function upsertJobs(jobs: NormalizedJob[]): number {
  if (jobs.length === 0) return 0;
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO jobs
      (id, external_id, title, company, location, salary_min, salary_max,
       description, url, source, remote, employment_type, match_score, posted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );

  let inserted = 0;
  for (const j of jobs) {
    stmt.run([
      uuidv4(),
      j.external_id,
      j.title,
      j.company,
      j.location,
      Math.round(j.salary_min || 0),
      Math.round(j.salary_max || 0),
      j.description || '',
      j.url || '',
      j.source,
      j.remote ? 1 : 0,
      j.employment_type || '',
      j.posted_at || now,
      now,
    ]);
    inserted += db.getRowsModified();
  }
  stmt.free();
  saveDb();
  return inserted;
}

/** Count of stored jobs + timestamp of the most-recently ingested one. */
export function getJobsStats(): { count: number; newest_created_at: string | null } {
  const row = queryOne<{ count: number; newest: string | null }>(
    'SELECT COUNT(*) as count, MAX(created_at) as newest FROM jobs'
  );
  return { count: row?.count || 0, newest_created_at: row?.newest || null };
}

/**
 * Search stored jobs with optional filters, then rank by profile match score.
 * When no profile is supplied, results fall back to recency order (neutral score).
 */
export function searchStoredJobs(
  profile: Profile | undefined,
  opts: { query?: string; location?: string; salaryMin?: number; limit?: number } = {}
): Job[] {
  const { query, location, salaryMin } = opts;
  const limit = opts.limit ?? 30;

  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params: unknown[] = [];

  if (query) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(company) LIKE ? OR LOWER(description) LIKE ?)';
    const like = `%${query.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (location) {
    sql += ' AND LOWER(location) LIKE ?';
    params.push(`%${location.toLowerCase()}%`);
  }
  if (salaryMin && salaryMin > 0) {
    // Keep jobs that meet the floor OR have no salary data (don't hide them).
    sql += ' AND (salary_max = 0 OR salary_max >= ?)';
    params.push(salaryMin);
  }

  // Pre-rank candidate pool by recency, then score in memory.
  sql += ' ORDER BY posted_at DESC LIMIT 400';

  const rows = queryAll<Job>(sql, params);
  const scored = rows.map((job) => ({ ...job, match_score: scoreJob(job, profile) }));
  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
  });
  return scored.slice(0, limit);
}

export function getJob(jobId: string): Job | undefined {
  return queryOne<Job>('SELECT * FROM jobs WHERE id = ?', [jobId]);
}

export function createJob(job: Job): Job {
  const now = new Date().toISOString();
  execute(
    `INSERT OR REPLACE INTO jobs (id, title, company, location, salary_min, salary_max, description, url, source, match_score, posted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.title, job.company, job.location, job.salary_min, job.salary_max, job.description, job.url, job.source, job.match_score, job.posted_at, now]
  );
  return job;
}

export function createApplication(userId: string, jobId: string, notes?: string): Application {
  const id = uuidv4();
  const now = new Date().toISOString();

  execute(
    `INSERT INTO applications (id, user_id, job_id, status, applied_at, updated_at, notes) VALUES (?, ?, ?, 'queued', ?, ?, ?)`,
    [id, userId, jobId, now, now, notes || null]
  );

  const app = queryOne<Application>('SELECT * FROM applications WHERE id = ?', [id])!;
  const job = getJob(jobId);
  return { ...app, job };
}

export function getApplications(userId: string, status?: string, limit: number = 20, offset: number = 0): Application[] {
  let sql = `
    SELECT a.id, a.user_id, a.job_id, a.status, a.applied_at, a.updated_at, a.notes,
           j.title as job_title, j.company as job_company, j.location as job_location,
           j.salary_min as job_salary_min, j.salary_max as job_salary_max, j.description as job_description,
           j.url as job_url, j.source as job_source, j.match_score as job_match_score, j.posted_at as job_posted_at
    FROM applications a
    LEFT JOIN jobs j ON a.job_id = j.id
    WHERE a.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = queryAll<Record<string, unknown>>(sql, params);

  return rows.map(row => ({
    id: row.id as string,
    user_id: row.user_id as string,
    job_id: row.job_id as string,
    status: row.status as Application['status'],
    applied_at: row.applied_at as string,
    updated_at: row.updated_at as string,
    notes: row.notes as string | null,
    job: row.job_title ? {
      id: row.job_id as string,
      title: row.job_title as string,
      company: row.job_company as string,
      location: row.job_location as string,
      salary_min: row.job_salary_min as number,
      salary_max: row.job_salary_max as number,
      description: row.job_description as string,
      url: row.job_url as string,
      source: row.job_source as string,
      match_score: row.job_match_score as number,
      posted_at: row.job_posted_at as string,
    } : undefined,
  }));
}

export function getApplication(applicationId: string): Application | undefined {
  const row = queryOne<Record<string, unknown>>(`
    SELECT a.id, a.user_id, a.job_id, a.status, a.applied_at, a.updated_at, a.notes,
           j.title as job_title, j.company as job_company, j.location as job_location,
           j.salary_min as job_salary_min, j.salary_max as job_salary_max, j.description as job_description,
           j.url as job_url, j.source as job_source, j.match_score as job_match_score, j.posted_at as job_posted_at
    FROM applications a
    LEFT JOIN jobs j ON a.job_id = j.id
    WHERE a.id = ?
  `, [applicationId]);

  if (!row) return undefined;

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    job_id: row.job_id as string,
    status: row.status as Application['status'],
    applied_at: row.applied_at as string,
    updated_at: row.updated_at as string,
    notes: row.notes as string | null,
    job: row.job_title ? {
      id: row.job_id as string,
      title: row.job_title as string,
      company: row.job_company as string,
      location: row.job_location as string,
      salary_min: row.job_salary_min as number,
      salary_max: row.job_salary_max as number,
      description: row.job_description as string,
      url: row.job_url as string,
      source: row.job_source as string,
      match_score: row.job_match_score as number,
      posted_at: row.job_posted_at as string,
    } : undefined,
  };
}

export function updateApplicationStatus(applicationId: string, status: string, notes?: string): Application | undefined {
  const now = new Date().toISOString();

  if (notes !== undefined) {
    execute('UPDATE applications SET status = ?, updated_at = ?, notes = ? WHERE id = ?', [status, now, notes, applicationId]);
  } else {
    execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', [status, now, applicationId]);
  }

  return getApplication(applicationId);
}

export function getDashboardStats(userId: string): DashboardStats {
  const total = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE user_id = ?', [userId]);

  const statusRows = queryAll<{ status: string; count: number }>(
    'SELECT status, COUNT(*) as count FROM applications WHERE user_id = ? GROUP BY status',
    [userId]
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const totalApps = total?.count || 0;
  const responded = (byStatus['screening'] || 0) + (byStatus['interview'] || 0) + (byStatus['offer'] || 0) + (byStatus['rejected'] || 0);
  const responseRate = totalApps > 0 ? Math.round((responded / totalApps) * 100) : 0;

  const recentRows = queryAll<{ id: string; status: string; updated_at: string; title: string; company: string }>(`
    SELECT a.id, a.status, a.updated_at, j.title, j.company
    FROM applications a
    LEFT JOIN jobs j ON a.job_id = j.id
    WHERE a.user_id = ?
    ORDER BY a.updated_at DESC
    LIMIT 10
  `, [userId]);

  const recentActivity: Activity[] = recentRows.map(row => ({
    id: row.id,
    type: row.status === 'queued' ? 'application_created' : 'status_updated',
    description: `${row.title} at ${row.company} - ${row.status}`,
    timestamp: row.updated_at,
  }));

  return {
    total_applications: totalApps,
    by_status: byStatus,
    response_rate: responseRate,
    interviews_scheduled: byStatus['interview'] || 0,
    offers_received: byStatus['offer'] || 0,
    recent_activity: recentActivity,
  };
}

export function getAppliedJobIds(userId: string): string[] {
  const rows = queryAll<{ job_id: string }>('SELECT job_id FROM applications WHERE user_id = ?', [userId]);
  return rows.map(r => r.job_id);
}

// ── WhatsApp notification preferences ──

export function getWhatsappPrefs(userId: string): WhatsappPrefs | undefined {
  return queryOne<WhatsappPrefs>('SELECT * FROM whatsapp_prefs WHERE user_id = ?', [userId]);
}

export function upsertWhatsappPrefs(
  userId: string,
  data: { phone?: string; opted_in?: boolean; digest_hour?: number; timezone?: string }
): WhatsappPrefs {
  const now = new Date().toISOString();
  const existing = getWhatsappPrefs(userId);

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.opted_in !== undefined) { fields.push('opted_in = ?'); values.push(data.opted_in ? 1 : 0); }
    if (data.digest_hour !== undefined) { fields.push('digest_hour = ?'); values.push(data.digest_hour); }
    if (data.timezone !== undefined) { fields.push('timezone = ?'); values.push(data.timezone); }
    fields.push('updated_at = ?'); values.push(now);
    values.push(userId);
    execute(`UPDATE whatsapp_prefs SET ${fields.join(', ')} WHERE user_id = ?`, values);
  } else {
    execute(
      `INSERT INTO whatsapp_prefs (user_id, phone, opted_in, digest_hour, timezone, last_sent_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        userId,
        data.phone ?? '',
        data.opted_in ? 1 : 0,
        data.digest_hour ?? 20,
        data.timezone ?? 'Asia/Kolkata',
        now,
        now,
      ]
    );
  }
  return getWhatsappPrefs(userId)!;
}

/** All users opted in with a phone number — used by the digest scheduler. */
export function listOptedInPrefs(): WhatsappPrefs[] {
  return queryAll<WhatsappPrefs>(
    "SELECT * FROM whatsapp_prefs WHERE opted_in = 1 AND phone != ''"
  );
}

export function markDigestSent(userId: string, dateStr: string): void {
  execute('UPDATE whatsapp_prefs SET last_sent_date = ? WHERE user_id = ?', [dateStr, userId]);
}

/**
 * Compute a user's activity digest for a given local date (YYYY-MM-DD).
 * "Today" is matched against the date portion of applied_at / updated_at.
 */
export function getDailyDigest(userId: string, dateStr: string): DailyDigest {
  const appliedToday = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM applications WHERE user_id = ? AND substr(applied_at, 1, 10) = ?",
    [userId, dateStr]
  );
  const changesToday = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM applications WHERE user_id = ? AND substr(updated_at, 1, 10) = ? AND status != 'queued'",
    [userId, dateStr]
  );

  const stats = getDashboardStats(userId);

  return {
    date: dateStr,
    applied_today: appliedToday?.count || 0,
    status_changes_today: changesToday?.count || 0,
    total_applications: stats.total_applications,
    interviews: stats.interviews_scheduled,
    offers: stats.offers_received,
    by_status: stats.by_status,
  };
}

// ── AI tailoring cache ──

export function getTailoring(
  userId: string,
  jobId: string
): { data: unknown; source: string; created_at: string } | undefined {
  const row = queryOne<{ data: string; source: string; created_at: string }>(
    'SELECT data, source, created_at FROM tailorings WHERE user_id = ? AND job_id = ?',
    [userId, jobId]
  );
  if (!row) return undefined;
  try {
    return { data: JSON.parse(row.data), source: row.source, created_at: row.created_at };
  } catch {
    return undefined;
  }
}

export function saveTailoring(userId: string, jobId: string, data: unknown, source: string): void {
  const now = new Date().toISOString();
  execute(
    `INSERT OR REPLACE INTO tailorings (user_id, job_id, data, source, created_at) VALUES (?, ?, ?, ?, ?)`,
    [userId, jobId, JSON.stringify(data), source, now]
  );
}

export function getInterviewPrep(
  userId: string,
  jobId: string
): { data: unknown; source: string; created_at: string } | undefined {
  const row = queryOne<{ data: string; source: string; created_at: string }>(
    'SELECT data, source, created_at FROM interview_preps WHERE user_id = ? AND job_id = ?',
    [userId, jobId]
  );
  if (!row) return undefined;
  try {
    return { data: JSON.parse(row.data), source: row.source, created_at: row.created_at };
  } catch {
    return undefined;
  }
}

export function saveInterviewPrep(userId: string, jobId: string, data: unknown, source: string): void {
  const now = new Date().toISOString();
  execute(
    `INSERT OR REPLACE INTO interview_preps (user_id, job_id, data, source, created_at) VALUES (?, ?, ?, ?, ?)`,
    [userId, jobId, JSON.stringify(data), source, now]
  );
}

// ── Auto-apply config & runs ──

export function getAutoApplyConfig(userId: string): AutoApplyConfig | undefined {
  return queryOne<AutoApplyConfig>('SELECT * FROM auto_apply_config WHERE user_id = ?', [userId]);
}

export function upsertAutoApplyConfig(
  userId: string,
  data: { enabled?: boolean; mode?: 'prepare' | 'auto'; daily_cap?: number; min_score?: number }
): AutoApplyConfig {
  const now = new Date().toISOString();
  const existing = getAutoApplyConfig(userId);
  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
    if (data.mode !== undefined) { fields.push('mode = ?'); values.push(data.mode); }
    if (data.daily_cap !== undefined) { fields.push('daily_cap = ?'); values.push(data.daily_cap); }
    if (data.min_score !== undefined) { fields.push('min_score = ?'); values.push(data.min_score); }
    fields.push('updated_at = ?'); values.push(now);
    values.push(userId);
    execute(`UPDATE auto_apply_config SET ${fields.join(', ')} WHERE user_id = ?`, values);
  } else {
    execute(
      `INSERT INTO auto_apply_config (user_id, enabled, mode, daily_cap, min_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.enabled ? 1 : 0,
        data.mode ?? 'prepare',
        data.daily_cap ?? 10,
        data.min_score ?? 65,
        now,
        now,
      ]
    );
  }
  return getAutoApplyConfig(userId)!;
}

export function recordAutoApplyRun(run: {
  user_id: string;
  mode: string;
  requested: number;
  prepared: number;
  skipped: number;
  summary: unknown;
}): AutoApplyRun {
  const id = uuidv4();
  const now = new Date().toISOString();
  execute(
    `INSERT INTO auto_apply_runs (id, user_id, mode, requested, prepared, skipped, summary, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, run.user_id, run.mode, run.requested, run.prepared, run.skipped, JSON.stringify(run.summary), now]
  );
  return queryOne<AutoApplyRun>('SELECT * FROM auto_apply_runs WHERE id = ?', [id])!;
}

export function getAutoApplyRuns(userId: string, limit = 10): AutoApplyRun[] {
  return queryAll<AutoApplyRun>(
    'SELECT * FROM auto_apply_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?',
    [userId, limit]
  );
}

/** How many applications the pipeline prepared today (for daily-cap enforcement). */
export function countAutoPreparedToday(userId: string, dateStr: string): number {
  const row = queryOne<{ total: number }>(
    "SELECT COALESCE(SUM(prepared), 0) as total FROM auto_apply_runs WHERE user_id = ? AND substr(started_at, 1, 10) = ?",
    [userId, dateStr]
  );
  return row?.total || 0;
}

// ── Analytics ──

export interface Analytics {
  totals: { applications: number; active: number; interviews: number; offers: number; rejected: number };
  funnel: { stage: string; count: number }[];
  by_source: { source: string; count: number }[];
  top_companies: { company: string; count: number }[];
  over_time: { date: string; count: number }[]; // last 14 days
  response_rate: number;
  interview_rate: number;
  offer_rate: number;
  avg_days_to_response: number;
}

const PIPELINE_STAGES = ['queued', 'applied', 'screening', 'interview', 'offer', 'rejected'];

export function getAnalytics(userId: string): Analytics {
  const rows = queryAll<{
    status: string;
    applied_at: string;
    updated_at: string;
    company: string | null;
    source: string | null;
  }>(
    `SELECT a.status, a.applied_at, a.updated_at, j.company, j.source
     FROM applications a LEFT JOIN jobs j ON a.job_id = j.id
     WHERE a.user_id = ?`,
    [userId]
  );

  const total = rows.length;
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byCompany: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  let respondedDays = 0;
  let respondedCount = 0;
  const respondedStatuses = new Set(['screening', 'interview', 'offer', 'rejected']);

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    const src = (r.source || 'other').split(':')[0];
    const srcLabel = src.charAt(0).toUpperCase() + src.slice(1);
    bySource[srcLabel] = (bySource[srcLabel] || 0) + 1;

    if (r.company) byCompany[r.company] = (byCompany[r.company] || 0) + 1;

    const day = (r.applied_at || '').slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;

    if (respondedStatuses.has(r.status) && r.applied_at && r.updated_at) {
      const days = (new Date(r.updated_at).getTime() - new Date(r.applied_at).getTime()) / 86400000;
      if (days >= 0) {
        respondedDays += days;
        respondedCount += 1;
      }
    }
  }

  const responded =
    (byStatus['screening'] || 0) + (byStatus['interview'] || 0) + (byStatus['offer'] || 0) + (byStatus['rejected'] || 0);
  const interviews = (byStatus['interview'] || 0) + (byStatus['offer'] || 0);
  const offers = byStatus['offer'] || 0;

  // Last 14 days continuous series.
  const overTime: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    overTime.push({ date: d, count: byDay[d] || 0 });
  }

  return {
    totals: {
      applications: total,
      active: total - (byStatus['rejected'] || 0),
      interviews,
      offers,
      rejected: byStatus['rejected'] || 0,
    },
    funnel: PIPELINE_STAGES.map((stage) => ({ stage, count: byStatus[stage] || 0 })),
    by_source: Object.entries(bySource)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    top_companies: Object.entries(byCompany)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    over_time: overTime,
    response_rate: total ? Math.round((responded / total) * 100) : 0,
    interview_rate: total ? Math.round((interviews / total) * 100) : 0,
    offer_rate: total ? Math.round((offers / total) * 100) : 0,
    avg_days_to_response: respondedCount ? Math.round((respondedDays / respondedCount) * 10) / 10 : 0,
  };
}

// ── Billing: subscriptions & usage ──

export function getSubscription(userId: string): Subscription | undefined {
  return queryOne<Subscription>('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
}

export function upsertSubscription(
  userId: string,
  data: { plan?: 'free' | 'pro'; status?: string; current_period_end?: string | null; provider?: string; provider_ref?: string | null }
): Subscription {
  const now = new Date().toISOString();
  const existing = getSubscription(userId);
  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    }
    fields.push('updated_at = ?'); values.push(now);
    values.push(userId);
    execute(`UPDATE subscriptions SET ${fields.join(', ')} WHERE user_id = ?`, values);
  } else {
    execute(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_end, provider, provider_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.plan ?? 'free',
        data.status ?? 'active',
        data.current_period_end ?? null,
        data.provider ?? 'mock',
        data.provider_ref ?? null,
        now,
        now,
      ]
    );
  }
  return getSubscription(userId)!;
}

export function logUsage(userId: string, kind: string): void {
  execute('INSERT INTO usage_events (id, user_id, kind, created_at) VALUES (?, ?, ?, ?)', [
    uuidv4(),
    userId,
    kind,
    new Date().toISOString(),
  ]);
}

/** Count usage events of a kind since the start of the current UTC month. */
export function countUsageThisMonth(userId: string, kind: string): number {
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const row = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM usage_events WHERE user_id = ? AND kind = ? AND substr(created_at, 1, 7) = ?",
    [userId, kind, monthPrefix]
  );
  return row?.count || 0;
}

export function getOrCreateDefaultUser(): User {
  const existing = queryOne<User>("SELECT * FROM users WHERE email = 'mcp@jobtracker.local'", []);
  if (existing) return existing;

  const id = uuidv4();
  const now = new Date().toISOString();
  execute(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, 'mcp@jobtracker.local', 'MCP User', 'no-password', ?)",
    [id, now]
  );

  return { id, email: 'mcp@jobtracker.local', name: 'MCP User', password_hash: 'no-password', created_at: now };
}
