export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface Profile {
  user_id: string;
  title: string;
  cities: string; // JSON array
  salary_min: number;
  salary_max: number;
  experience_years: number;
  skills: string; // JSON array
  summary: string;
  resume_path: string | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number;
  salary_max: number;
  description: string;
  url: string;
  source: string;
  match_score: number;
  posted_at: string;
  created_at?: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: 'queued' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected';
  applied_at: string;
  updated_at: string;
  notes: string | null;
  job?: Job;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  total_applications: number;
  by_status: Record<string, number>;
  response_rate: number;
  interviews_scheduled: number;
  offers_received: number;
  recent_activity: Activity[];
}

export interface WhatsappPrefs {
  user_id: string;
  phone: string;
  opted_in: number; // 0 | 1
  digest_hour: number; // 0-23, local to timezone
  timezone: string;
  last_sent_date: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  applied_today: number;
  status_changes_today: number;
  total_applications: number;
  interviews: number;
  offers: number;
  by_status: Record<string, number>;
}

export interface AutoApplyConfig {
  user_id: string;
  enabled: number; // 0 | 1
  mode: 'prepare' | 'auto';
  daily_cap: number;
  min_score: number;
  created_at: string;
  updated_at: string;
}

export interface AutoApplyRun {
  id: string;
  user_id: string;
  mode: string;
  requested: number;
  prepared: number;
  skipped: number;
  summary: string; // JSON array of items
  started_at: string;
}

// Express request augmentation
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
