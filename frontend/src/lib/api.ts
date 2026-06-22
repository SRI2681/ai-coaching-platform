const PRODUCTION_API_URL = 'https://ai-coaching-platform-api.vercel.app';
const LOCAL_API_URL = 'http://localhost:8000';

function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_API_URL;
    }
    return PRODUCTION_API_URL;
  }

  return process.env.BACKEND_URL || PRODUCTION_API_URL;
}

const defaultHeaders = {
  'Content-Type': 'application/json'
};

export interface LoginResponse {
  candidate_id: string;
  first_name: string;
  current_cdl: number;
  coach_name: string;
}

export interface StartSessionResponse {
  session_id: string;
  coach_opening: string;
  framework: string;
  current_cdl: number;
  coach_name: string;
}

export interface AvatarSessionResponse {
  session_id: string;
  framework: string;
  current_cdl: number;
  session_token: string | null;
  fallback_mode: boolean;
  fallback_reason?: string;
  persona_id?: string;
}

export interface SessionDebrief {
  summary_text: string;
  key_win: string;
  key_gap: string;
  key_insight: string | null;
  action_item: string;
  growth_moment: string | null;
  cdl_start: number;
  cdl_end: number;
  cdl_movement: string;
  framework?: string;
}

export interface EndSessionResponse {
  debrief: SessionDebrief;
}

export interface TeamAnalytics {
  team_size: number;
  avg_cdl: number;
  cdl_distribution: Record<string, number>;
  total_sessions?: number;
}

export interface RolePlayScenario {
  id: string;
  title: string;
  description: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiBase = getApiBase();
  let response: Response;

  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        ...defaultHeaders,
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new Error(
      'Unable to reach the server. Please check your internet connection and try again.'
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const errorMessage =
      data?.detail || data?.error || data?.message || response.statusText;
    throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
  }

  return data as T;
}

export async function registerCandidate(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role_title: string;
  role_level: string;
  coach_name: string;
  primary_goal: string;
}) {
  return request<{ candidate_id: string; message: string }>('/api/coaching/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function loginCandidate(email: string, password: string) {
  return request<LoginResponse>('/api/coaching/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function startSession(candidateId: string, sessionType = 'voice') {
  return request<StartSessionResponse>('/api/coaching/start', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, session_type: sessionType })
  });
}

export async function startAvatarSession(candidateId: string) {
  return request<AvatarSessionResponse>('/api/coaching/avatar-session/start', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, session_type: 'avatar' })
  });
}

export async function endSession(sessionId: string, candidateId: string) {
  return request<EndSessionResponse>(`/api/coaching/end/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId })
  });
}

export async function getTeamAnalytics(companyId: string) {
  return request<TeamAnalytics>(`/api/employer/team-analytics?company_id=${encodeURIComponent(companyId)}`);
}

export async function getRolePlayScenarios() {
  return request<RolePlayScenario[]>('/api/employer/scenarios');
}
