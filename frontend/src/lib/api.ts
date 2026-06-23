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
      mode: 'cors',
      headers: {
        ...defaultHeaders,
        ...(init.headers ?? {})
      }
    });
  } catch (err) {
    const hint = err instanceof Error ? err.message : '';
    throw new Error(
      hint
        ? `Unable to reach the server (${hint}). Check your connection or try again in a moment.`
        : 'Unable to reach the server. Please check your internet connection and try again.'
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
  invite_token?: string;
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

export async function endSession(
  sessionId: string,
  candidateId: string,
  recordingUrl?: string,
  vapiCallId?: string
) {
  return request<EndSessionResponse>(`/api/coaching/end/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      candidate_id: candidateId,
      recording_url: recordingUrl,
      vapi_call_id: vapiCallId,
    }),
  });
}

export async function updateSessionCallMeta(
  sessionId: string,
  data: { vapi_call_id?: string; recording_url?: string }
) {
  return request<{ updated: boolean }>(`/api/coaching/session/${sessionId}/call-meta`, {
    method: 'PATCH',
    body: JSON.stringify({
      vapi_call_id: data.vapi_call_id,
      recording_url: data.recording_url,
    }),
  });
}

export async function getTeamAnalytics(companyId: string) {
  return request<TeamAnalytics>(`/api/employer/team-analytics?company_id=${encodeURIComponent(companyId)}`);
}

export async function getRolePlayScenarios() {
  return request<RolePlayScenario[]>('/api/employer/scenarios');
}

// ── Goals (Page 14) ───────────────────────────────────────────────────────────

export interface CandidateGoal {
  id: string;
  candidate_id: string;
  goal_text?: string;
  title?: string;
  description?: string | null;
  theme?: string | null;
  status?: string;
  is_org_assigned?: boolean;
  assigned_by?: string | null;
  org_id?: string | null;
}

export async function getCandidateGoals(candidateId: string) {
  return request<CandidateGoal[]>(`/api/goals/${encodeURIComponent(candidateId)}`);
}

export async function createGoal(data: {
  candidate_id: string;
  title: string;
  description?: string;
  theme?: string;
}) {
  return request<CandidateGoal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGoal(
  goalId: string,
  data: { title?: string; description?: string; theme?: string }
) {
  return request<CandidateGoal>(`/api/goals/${encodeURIComponent(goalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Assessments (Page 15) ───────────────────────────────────────────────────

export interface AssessmentQuestion {
  question: string;
  competency_focus?: string;
  competency_lens?: string;
  skill_target?: string;
  tier?: number;
}

export interface MethodologyProfile {
  clifton_themes?: string[];
  disc_profile?: {
    dominance?: number;
    influence?: number;
    steadiness?: number;
    conscientiousness?: number;
  };
  disc_style?: string;
  executive_summary?: string;
}

export interface AssessmentResult {
  score: number;
  strategic_score: number;
  operational_score: number;
  influence_score: number;
  level: string;
  strengths: string[];
  gaps: string[];
  methodology_profile?: MethodologyProfile;
  goal_progress_pct?: number;
}

export interface BaselineRecord extends AssessmentResult {
  assessment_id?: string;
  completed_at?: string;
  goal_id?: string;
}

export interface AssessmentStatus {
  baselineCompleted: boolean;
  baseline: BaselineRecord | null;
  baselineInProgress: boolean;
  inProgressAssessmentId?: string | null;
  canTakeProgressTest: boolean;
}

export interface AssessmentStartResponse {
  assessment_id: string;
  question: AssessmentQuestion;
  tier?: number;
  already_completed?: boolean;
  resumed?: boolean;
  questions_answered?: number;
  result?: BaselineRecord;
}

export interface AssessmentAnswerResponse {
  done: boolean;
  question?: AssessmentQuestion;
  tier?: number;
  result?: AssessmentResult;
}

export async function getAssessmentStatus(candidateId: string) {
  return request<AssessmentStatus>(`/api/assessments/status/${encodeURIComponent(candidateId)}`);
}

export async function getBaselineAssessment(candidateId: string) {
  return request<BaselineRecord>(`/api/assessments/baseline/${encodeURIComponent(candidateId)}`);
}

export async function startAssessment(candidateId: string, goal: string, type = 'baseline') {
  return request<AssessmentStartResponse>('/api/assessments/start', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, goal, type }),
  });
}

export async function answerAssessment(data: {
  assessment_id: string;
  question: string;
  answer: string;
  tier: number;
  skill_target?: string;
  competency_lens?: string;
}) {
  return request<AssessmentAnswerResponse>('/api/assessments/answer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Action plans (Page 18) ────────────────────────────────────────────────────

export interface ActionPlan {
  id: string;
  candidate_id: string;
  goal_id?: string | null;
  focus_areas?: string[];
  summary?: string;
  status?: string;
  created_at?: string;
}

export interface ActionItem {
  id: string;
  action_plan_id: string;
  candidate_id: string;
  kind: string;
  title: string;
  detail?: string | null;
  due_date?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export async function generateActionPlan(data: {
  candidate_id: string;
  goal: string;
  baseline: AssessmentResult | Record<string, unknown>;
  goal_id?: string;
}) {
  return request<{ plan_id: string; plan: ActionPlan; items: ActionItem[] }>(
    '/api/action-plans/generate',
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export async function getActionPlan(candidateId: string) {
  return request<{ plan: ActionPlan; items: ActionItem[] }>(
    `/api/action-plans/${encodeURIComponent(candidateId)}`
  );
}

export async function updateActionItem(itemId: string, isCompleted: boolean) {
  return request<ActionItem>(`/api/action-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  });
}

// ── Progress (Page 19) ────────────────────────────────────────────────────────

export interface AssessmentTrend {
  type: string;
  score: number | null;
  level?: string | null;
  date?: string | null;
}

export interface ProgressChartPoint {
  type: string;
  score: number;
  date?: string | null;
}

export interface ProgressMetrics {
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  progressPercent: number;
  goalProgressPct?: number | null;
  assessmentTrends: AssessmentTrend[];
  progressChart: ProgressChartPoint[];
  actionPlanCompletionPercent: number;
  sessionCount: number;
  goalTitle: string;
}

export async function getProgressMetrics(candidateId: string) {
  return request<ProgressMetrics>(`/api/progress/${encodeURIComponent(candidateId)}`);
}

// ── Reports (Page 22) ─────────────────────────────────────────────────────────

export interface ReportAssessmentResult {
  type: string;
  score: number | null;
}

export interface ReportPayload {
  goalTitle: string;
  baselineScore: number;
  finalScore: number;
  assessmentResults: ReportAssessmentResult[];
  progressChart: ProgressChartPoint[];
  strengths: string[];
  developmentAreas: string[];
  finalReadinessLevel: string;
  summary?: string;
  sessionCount?: number;
  actionPlanCompletionPercent?: number;
  progressPercent?: number;
  scoreDelta?: number;
}

export interface SavedReport {
  report_id: string;
  payload: ReportPayload;
  created_at?: string;
}

export async function generateReport(candidateId: string, orgId?: string) {
  return request<SavedReport>('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ candidate_id: candidateId, org_id: orgId }),
  });
}

export async function getSavedReport(candidateId: string) {
  return request<SavedReport>(`/api/reports/${encodeURIComponent(candidateId)}`);
}

// ── Organization portal (Section 8) ───────────────────────────────────────────

export interface OrgLoginResponse {
  admin_id: string;
  org_id: string;
  org_name: string;
  first_name: string;
  role: string;
}

export interface RosterCandidate {
  candidateId: string;
  name: string;
  goal: string;
  goalIsOrgAssigned: boolean;
  status: string;
  baselineScore: number;
  currentScore: number;
  progressPercent: number;
  riskLevel: string;
  pipelineStage: string;
  sessionCount: number;
  actionPlanCompletionPercent: number;
  cdl?: number;
}

export interface OrgRoster {
  orgId: string;
  candidates: RosterCandidate[];
  total: number;
}

export interface PipelineStage {
  name: string;
  count: number;
  avgScore: number;
  atRiskCount: number;
  candidates: {
    candidateId: string;
    name: string;
    currentScore: number;
    riskLevel: string;
    progressPercent: number;
  }[];
}

export interface OrgPipeline {
  orgId: string;
  stages: Record<string, PipelineStage>;
  metrics: {
    totalLeaders: number;
    onTrackPercent: number;
    readyCount: number;
    atRiskTotal: number;
  };
}

const THEMES = [
  'Executive Presence',
  'Strategic Influence',
  'Operational Excellence',
  'Team Leadership',
  'Communication',
];

export { THEMES as ORG_GOAL_THEMES };

export async function loginOrgAdmin(email: string, password: string, organizationId?: string) {
  return request<OrgLoginResponse>('/api/org/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      organization_id: organizationId || undefined,
    }),
  });
}

export interface PlatformLoginResponse {
  admin_id: string;
  first_name: string;
  role: string;
}

export interface PlatformOverview {
  organizationCount: number;
  candidateCount: number;
  sessionCount: number;
  pendingInvites: number;
}

export async function loginPlatformAdmin(email: string, password: string) {
  return request<PlatformLoginResponse>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getPlatformOverview(adminId: string) {
  return request<PlatformOverview>(
    `/api/admin/overview?admin_id=${encodeURIComponent(adminId)}`
  );
}

export async function getOrgRoster(orgId: string, adminId: string) {
  return request<OrgRoster>(
    `/api/org/${encodeURIComponent(orgId)}/roster?admin_id=${encodeURIComponent(adminId)}`
  );
}

export async function getOrgPipeline(orgId: string, adminId: string) {
  return request<OrgPipeline>(
    `/api/org/${encodeURIComponent(orgId)}/pipeline?admin_id=${encodeURIComponent(adminId)}`
  );
}

export async function assignOrgGoal(
  orgId: string,
  data: {
    admin_id: string;
    candidate_id: string;
    title: string;
    description?: string;
    theme?: string;
  }
) {
  return request<{ goal_id: string; candidate_id: string; title: string; is_org_assigned: boolean }>(
    `/api/org/${encodeURIComponent(orgId)}/assign-goal`,
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export interface OrgRegisterResponse {
  org_id: string;
  org_name: string;
  admin_id: string;
  invites: { email: string; invite_token: string; status: string }[];
}

export interface InviteLookup {
  invite_token: string;
  email: string;
  status: string;
  org_id: string;
  org_name: string;
}

export interface OrgProgressDashboard {
  orgId: string;
  overallPercent: number;
  completionRate: number;
  improvementRate: number;
  riskAlerts: { candidateId: string; name: string; riskLevel: string; reason: string }[];
  totals: {
    leaders: number;
    pendingInvites: number;
    acceptedInvites: number;
    onTrack?: number;
    atRisk?: number;
  };
  averages: {
    baselineScore: number;
    currentScore: number;
    progressPercent: number;
    actionPlanCompletionPercent: number;
  };
  leaders: {
    candidateId: string;
    name: string;
    baselineScore: number;
    currentScore: number;
    progressPercent: number;
    riskLevel: string;
    sessionCount: number;
  }[];
}

export interface CandidateProfile {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleTitle: string;
  roleLevel: string;
  coachName: string;
  cdl: number;
  orgId?: string | null;
  orgName?: string | null;
  baselineCompleted: boolean;
  baseline: BaselineRecord | null;
  activeGoal: { title?: string | null; theme?: string | null; isOrgAssigned: boolean };
  progress: ProgressMetrics;
  assessments: { type: string; score: number; level: string; date?: string; goalProgressPct?: number }[];
  sessions: { id: string; framework: string; completedAt?: string; hasRecording: boolean }[];
  actionPlan: { focusAreas: string[]; completionPercent: number };
}

export async function getOrgInvites(orgId: string, adminId: string) {
  return request<{ invites: { email: string; invite_token: string; status: string }[] }>(
    `/api/org/${encodeURIComponent(orgId)}/invites?admin_id=${encodeURIComponent(adminId)}`
  );
}

export async function registerOrganization(data: {
  org_name: string;
  contact_email: string;
  plan?: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  admin_password: string;
  invite_emails: string[];
}) {
  return request<OrgRegisterResponse>('/api/org/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function lookupInvite(token: string) {
  return request<InviteLookup>(`/api/org/invites/lookup?token=${encodeURIComponent(token)}`);
}

export async function acceptInvite(inviteToken: string, candidateId: string) {
  return request<{ org_id: string; org_name: string; linked: boolean }>('/api/org/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ invite_token: inviteToken, candidate_id: candidateId }),
  });
}

export async function addOrgInvites(orgId: string, adminId: string, emails: string[]) {
  return request<{ invites: { email: string; invite_token: string; status: string }[] }>(
    `/api/org/${encodeURIComponent(orgId)}/invites`,
    { method: 'POST', body: JSON.stringify({ admin_id: adminId, emails }) }
  );
}

export async function getOrgProgressDashboard(orgId: string, adminId: string) {
  return request<OrgProgressDashboard>(
    `/api/org/${encodeURIComponent(orgId)}/progress-dashboard?admin_id=${encodeURIComponent(adminId)}`
  );
}

export async function getCandidateProfile(candidateId: string) {
  return request<CandidateProfile>(`/api/candidates/${encodeURIComponent(candidateId)}/profile`);
}
