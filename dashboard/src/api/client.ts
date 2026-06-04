const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('jt_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      (errorData as { message?: string }).message ||
      (errorData as { error?: string }).error ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ---- Types ----

export interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Profile {
  userId?: string;
  title?: string;
  summary?: string;
  skills?: string[];
  targetCities?: string[];
  salaryMin?: number;
  salaryMax?: number;
  experienceYears?: number;
  resumeFile?: string;
}

export interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  url?: string;
  source?: string;
  matchScore?: number;
  postedAt?: string;
}

export interface SearchJobsParams {
  query?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export type ApplicationStatus =
  | 'queued'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface Application {
  _id: string;
  userId: string;
  jobId: string;
  job?: Job;
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  notes?: string;
}

export interface DashboardStats {
  totalApplications: number;
  interviews: number;
  offers: number;
  responseRate: number;
  recentActivity: {
    action: string;
    company: string;
    jobTitle: string;
    date: string;
  }[];
  pipeline: Record<ApplicationStatus, number>;
}

// ---- Transformers ----

function mapUser(raw: Record<string, unknown>): User {
  return {
    _id: (raw.id || raw._id) as string,
    name: raw.name as string,
    email: raw.email as string,
    createdAt: (raw.created_at || raw.createdAt) as string,
  };
}

function prettySource(source: string | undefined): string | undefined {
  if (!source) return source;
  if (source.startsWith('greenhouse:')) return 'Greenhouse';
  if (source === 'remotive') return 'Remotive';
  if (source === 'adzuna') return 'Adzuna';
  return source;
}

function mapJob(raw: Record<string, unknown>): Job {
  return {
    _id: (raw.id || raw._id) as string,
    title: raw.title as string,
    company: raw.company as string,
    location: raw.location as string,
    salaryMin: (raw.salary_min ?? raw.salaryMin) as number | undefined,
    salaryMax: (raw.salary_max ?? raw.salaryMax) as number | undefined,
    description: raw.description as string | undefined,
    url: raw.url as string | undefined,
    source: prettySource(raw.source as string | undefined),
    matchScore: (raw.match_score ?? raw.matchScore) as number | undefined,
    postedAt: (raw.posted_at ?? raw.postedAt) as string | undefined,
  };
}

function mapApplication(raw: Record<string, unknown>): Application {
  const job = raw.job ? mapJob(raw.job as Record<string, unknown>) : undefined;
  return {
    _id: (raw.id || raw._id) as string,
    userId: (raw.user_id || raw.userId) as string,
    jobId: (raw.job_id || raw.jobId) as string,
    job,
    company: job?.company ?? (raw.company as string) ?? '',
    jobTitle: job?.title ?? (raw.jobTitle as string) ?? '',
    status: raw.status as ApplicationStatus,
    appliedAt: (raw.applied_at || raw.appliedAt) as string,
    updatedAt: (raw.updated_at || raw.updatedAt) as string,
    notes: raw.notes as string | undefined,
  };
}

function mapProfile(raw: Record<string, unknown>): Profile {
  return {
    userId: (raw.user_id || raw.userId) as string | undefined,
    title: raw.title as string | undefined,
    summary: raw.summary as string | undefined,
    skills: raw.skills as string[] | undefined,
    targetCities: (raw.cities || raw.targetCities) as string[] | undefined,
    salaryMin: (raw.salary_min ?? raw.salaryMin) as number | undefined,
    salaryMax: (raw.salary_max ?? raw.salaryMax) as number | undefined,
    experienceYears: (raw.experience_years ?? raw.experienceYears) as number | undefined,
    resumeFile: (raw.resume_path || raw.resumeFile) as string | undefined,
  };
}

// ---- Auth ----

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { token: data.token, user: mapUser(data.user) };
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const data = await request<{ token: string; user: Record<string, unknown> }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return { token: data.token, user: mapUser(data.user) };
}

export async function getMe(): Promise<User> {
  const data = await request<{ user: Record<string, unknown> }>('/auth/me');
  return mapUser(data.user);
}

// ---- Profile ----

export async function getProfile(): Promise<Profile> {
  const data = await request<{ profile: Record<string, unknown> | null }>('/profile');
  if (!data.profile) return {};
  return mapProfile(data.profile);
}

export async function updateProfile(profile: Partial<Profile>): Promise<Profile> {
  const body: Record<string, unknown> = {};
  if (profile.title !== undefined) body.title = profile.title;
  if (profile.targetCities !== undefined) body.cities = profile.targetCities;
  if (profile.salaryMin !== undefined) body.salary_min = profile.salaryMin;
  if (profile.salaryMax !== undefined) body.salary_max = profile.salaryMax;
  if (profile.experienceYears !== undefined) body.experience_years = profile.experienceYears;
  if (profile.skills !== undefined) body.skills = profile.skills;
  if (profile.summary !== undefined) body.summary = profile.summary;

  const data = await request<{ profile: Record<string, unknown> }>('/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return mapProfile(data.profile);
}

export async function uploadResume(file: File): Promise<{ filename: string }> {
  const formData = new FormData();
  formData.append('resume', file);
  const data = await request<{ message: string }>('/profile/resume', {
    method: 'POST',
    body: formData,
  });
  return { filename: data.message };
}

// ---- Jobs ----

export async function searchJobs(params?: SearchJobsParams): Promise<Job[]> {
  const searchParams = new URLSearchParams();
  if (params?.query) searchParams.set('query', params.query);
  if (params?.location) searchParams.set('location', params.location);
  if (params?.salaryMin) searchParams.set('salary_min', String(params.salaryMin));
  const qs = searchParams.toString();
  const url = `/jobs/search${qs ? `?${qs}` : ''}`;

  const data = await request<{ jobs: Record<string, unknown>[]; total: number }>(url);
  return data.jobs.map(mapJob);
}

// ---- Applications ----

export async function getApplications(status?: ApplicationStatus): Promise<Application[]> {
  const query = status ? `?status=${status}` : '';
  const data = await request<{ applications: Record<string, unknown>[]; total: number }>(`/applications${query}`);
  return data.applications.map(mapApplication);
}

export async function createApplication(jobId: string): Promise<Application> {
  const data = await request<{ application: Record<string, unknown> }>('/applications', {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId }),
  });
  return mapApplication(data.application);
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application> {
  const data = await request<{ application: Record<string, unknown> }>(`/applications/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return mapApplication(data.application);
}

// ---- Notifications (WhatsApp) ----

export interface WhatsappPrefs {
  phone: string;
  optedIn: boolean;
  digestHour: number;
  timezone: string;
  lastSentDate: string | null;
  providerLive: boolean;
}

function mapPrefs(raw: Record<string, unknown>): WhatsappPrefs {
  return {
    phone: (raw.phone as string) ?? '',
    optedIn: Boolean(raw.opted_in),
    digestHour: (raw.digest_hour as number) ?? 20,
    timezone: (raw.timezone as string) ?? 'Asia/Kolkata',
    lastSentDate: (raw.last_sent_date as string) ?? null,
    providerLive: Boolean(raw.provider_live),
  };
}

export async function getWhatsappPrefs(): Promise<WhatsappPrefs> {
  const data = await request<{ prefs: Record<string, unknown> }>('/notifications/whatsapp');
  return mapPrefs(data.prefs);
}

export async function updateWhatsappPrefs(input: {
  phone?: string;
  optedIn?: boolean;
  digestHour?: number;
  timezone?: string;
}): Promise<WhatsappPrefs> {
  const body: Record<string, unknown> = {};
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.optedIn !== undefined) body.opted_in = input.optedIn;
  if (input.digestHour !== undefined) body.digest_hour = input.digestHour;
  if (input.timezone !== undefined) body.timezone = input.timezone;
  const data = await request<{ prefs: Record<string, unknown> }>('/notifications/whatsapp', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return mapPrefs(data.prefs);
}

export interface TestDigestResult {
  message: string;
  mock: boolean;
  preview: string;
  digest: {
    date: string;
    applied_today: number;
    status_changes_today: number;
    total_applications: number;
    interviews: number;
    offers: number;
  };
}

export function sendTestDigest(): Promise<TestDigestResult> {
  return request<TestDigestResult>('/notifications/whatsapp/test', { method: 'POST' });
}

// ---- Dashboard ----

export async function getDashboardStats(): Promise<DashboardStats> {
  const data = await request<{
    stats: {
      total_applications: number;
      by_status: Record<string, number>;
      response_rate: number;
      interviews_scheduled: number;
      offers_received: number;
      recent_activity: {
        id: string;
        type: string;
        description: string;
        timestamp: string;
      }[];
    };
  }>('/applications/stats');

  const s = data.stats;
  return {
    totalApplications: s.total_applications,
    interviews: s.interviews_scheduled,
    offers: s.offers_received,
    responseRate: s.response_rate,
    pipeline: {
      queued: s.by_status['queued'] || 0,
      applied: s.by_status['applied'] || 0,
      screening: s.by_status['screening'] || 0,
      interview: s.by_status['interview'] || 0,
      offer: s.by_status['offer'] || 0,
      rejected: s.by_status['rejected'] || 0,
    },
    recentActivity: s.recent_activity.map((a) => {
      const parts = a.description.split(' at ');
      const jobTitle = parts[0] || '';
      const rest = parts.slice(1).join(' at ');
      const company = rest.split(' - ')[0] || '';
      const statusPart = rest.split(' - ').slice(1).join(' - ');
      return {
        action: `Status: ${statusPart || a.type}`,
        company,
        jobTitle,
        date: a.timestamp,
      };
    }),
  };
}
