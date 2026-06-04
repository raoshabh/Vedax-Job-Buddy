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

// Express request augmentation
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
