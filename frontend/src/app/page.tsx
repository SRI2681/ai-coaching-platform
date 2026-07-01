'use client';

import { useEffect, useState, useCallback, type FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LandingHeader from '@/components/landing/landing-header';
import ScenarioPreview from '@/components/landing/scenario-preview';
import HowItWorks from '@/components/landing/how-it-works';
import {
  acceptInvite,
  loginCandidate,
  loginOrgAdmin,
  loginPlatformAdmin,
  lookupInvite,
  registerCandidate,
} from '@/lib/api';

type PortalType = 'candidate' | 'organization' | 'admin';
type AuthMode = 'login' | 'signup';

const PORTALS: { id: PortalType; label: string; description: string }[] = [
  { id: 'candidate', label: 'Candidate', description: 'Leaders in coaching programs' },
  { id: 'organization', label: 'Organization', description: 'HR and program admins' },
  { id: 'admin', label: 'Platform Admin', description: 'Platform operations' },
];

const inputClassName = 'input-premium';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className='min-h-screen flex items-center justify-center'>Loading...</div>}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const portalParam = searchParams.get('portal') as PortalType | null;

  const [portal, setPortal] = useState<PortalType>('candidate');
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (portalParam && PORTALS.some((p) => p.id === portalParam)) {
      setPortal(portalParam);
    }
  }, [portalParam]);

  useEffect(() => {
    if (!inviteToken) return;
    lookupInvite(inviteToken)
      .then((inv) => {
        setOrgName(inv.org_name);
        setEmail(inv.email);
        setPortal('candidate');
        setMode('signup');
      })
      .catch(() => undefined);
  }, [inviteToken]);

  function persistCandidateSession(result: {
    candidate_id: string;
    first_name?: string;
    current_cdl?: number;
    coach_name?: string;
  }) {
    localStorage.setItem('candidate_id', result.candidate_id);
    localStorage.setItem('first_name', result.first_name ?? firstName);
    localStorage.setItem('current_cdl', String(result.current_cdl ?? 1));
    localStorage.setItem('coach_name', result.coach_name ?? 'Alex');
  }

  function clearOtherSessions() {
    localStorage.removeItem('org_admin_id');
    localStorage.removeItem('org_id');
    localStorage.removeItem('org_name');
    localStorage.removeItem('platform_admin_id');
    localStorage.removeItem('platform_admin_name');
  }

  async function handleCandidateLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await loginCandidate(email, password);
      clearOtherSessions();
      persistCandidateSession(result);
      if (inviteToken) {
        await acceptInvite(inviteToken, result.candidate_id).catch(() => undefined);
      }
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
      if (message.toLowerCase().includes('sign up') || message.toLowerCase().includes('no password')) {
        setMode('signup');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCandidateSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await registerCandidate({
        email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_title: 'Leader',
        role_level: 'manager',
        coach_name: 'Alex',
        primary_goal: primaryGoal.trim() || 'Develop leadership skills',
        invite_token: inviteToken || undefined,
      });
      const result = await loginCandidate(email, password);
      clearOtherSessions();
      persistCandidateSession(result);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create account.';
      setError(message);
      if (message.toLowerCase().includes('sign in')) {
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOrgLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await loginOrgAdmin(email, password, organizationId.trim() || undefined);
      localStorage.clear();
      localStorage.setItem('org_admin_id', result.admin_id);
      localStorage.setItem('org_id', result.org_id);
      localStorage.setItem('org_name', result.org_name);
      localStorage.setItem('org_admin_name', result.first_name);
      router.push('/org/roster');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await loginPlatformAdmin(email, password);
      localStorage.clear();
      localStorage.setItem('platform_admin_id', result.admin_id);
      localStorage.setItem('platform_admin_name', result.first_name);
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  function switchPortal(next: PortalType) {
    setPortal(next);
    setError('');
    if (next !== 'candidate') setMode('login');
  }

  const portalTheme =
    portal === 'organization'
      ? 'slate'
      : portal === 'admin'
        ? 'violet'
        : 'blue';

  const accentBtn =
    portalTheme === 'slate'
      ? 'btn-primary !bg-gradient-to-r !from-slate-800 !to-slate-900 !shadow-slate-500/30'
      : portalTheme === 'violet'
        ? 'btn-primary btn-accent-violet'
        : 'btn-primary';

  const scrollToAuth = useCallback(() => {
    document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPortal('candidate');
    setMode('signup');
  }, []);

  useEffect(() => {
    if (inviteToken) {
      setTimeout(() => scrollToAuth(), 300);
    }
  }, [inviteToken, scrollToAuth]);

  return (
    <div className='landing-page'>
      <LandingHeader onGetStarted={scrollToAuth} />

      <section className='landing-hero'>
        <h1 className='landing-hero-title'>
          Aspiring executives{' '}
          <span className='landing-hero-accent'>lead with confidence</span> after AI coaching with us
        </h1>
        <p className='landing-hero-sub'>
          Practice boardroom conversations, difficult feedback, and stakeholder influence with a
          life-like AI executive coach. Build presence, get scored, and grow measurably.
        </p>
        <div className='landing-hero-wrap'>
          <ScenarioPreview onStart={scrollToAuth} />
        </div>

        <div className='landing-trust-row'>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>5</div>
            <div className='landing-trust-label'>CDL levels</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>9+</div>
            <div className='landing-trust-label'>Coaching frameworks</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>Voice</div>
            <div className='landing-trust-label'>& avatar sessions</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>30d</div>
            <div className='landing-trust-label'>Action plans</div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section id='get-started' className='landing-auth'>
        <div className='landing-auth-inner'>
          <h2 className='landing-auth-title'>Start your coaching journey</h2>
          <p className='text-slate-500 text-center text-sm mb-6'>
            Sign in or create your account to practice live
          </p>
          <div className='card-premium p-8'>

        <div className='mb-6 grid grid-cols-3 gap-2'>
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type='button'
              onClick={() => switchPortal(p.id)}
              className={`rounded-xl border px-2 py-3 text-left transition-all ${
                portal === p.id
                  ? portal === 'organization'
                    ? 'border-slate-800 bg-slate-50 shadow-sm ring-1 ring-slate-200'
                    : portal === 'admin'
                      ? 'border-violet-600 bg-violet-50 shadow-sm ring-1 ring-violet-200'
                      : 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className='text-sm font-semibold text-gray-900'>{p.label}</div>
              <div className='text-[10px] text-gray-500 mt-0.5 leading-tight'>{p.description}</div>
            </button>
          ))}
        </div>

        {portal === 'candidate' && (
          <>
            <p className='text-sm text-gray-500 text-center mb-4'>
              {orgName
                ? `Join ${orgName} coaching program`
                : mode === 'login'
                  ? 'Sign in as a coaching candidate'
                  : 'Create your candidate account'}
            </p>
            <div className='mb-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1'>
              <button
                type='button'
                onClick={() => { setMode('login'); setError(''); }}
                className={`rounded-md py-2 text-sm font-semibold ${
                  mode === 'login' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Sign In
              </button>
              <button
                type='button'
                onClick={() => { setMode('signup'); setError(''); }}
                className={`rounded-md py-2 text-sm font-semibold ${
                  mode === 'signup' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Sign Up
              </button>
            </div>
            {mode === 'login' ? (
              <form onSubmit={handleCandidateLogin} className='space-y-4'>
                <Field label='Email' type='email' value={email} onChange={setEmail} autoComplete='email' />
                <Field label='Password' type='password' value={password} onChange={setPassword} autoComplete='current-password' />
                {error && <ErrorBox message={error} />}
                <button type='submit' disabled={loading} className={`${accentBtn} disabled:opacity-50`}>
                  {loading ? 'Signing in...' : 'Sign In as Candidate'}
                </button>
                <p className='text-xs text-gray-500 text-center'>
                  Invited by your company? Use <strong>Sign Up</strong> to set your password.
                  If you see &quot;already registered&quot;, try <strong>Sign In</strong> or Sign Up again to finish setup.
                </p>
              </form>
            ) : (
              <form onSubmit={handleCandidateSignup} className='space-y-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <Field label='First name' value={firstName} onChange={setFirstName} autoComplete='given-name' required />
                  <Field label='Last name' value={lastName} onChange={setLastName} autoComplete='family-name' required />
                </div>
                <Field label='Email' type='email' value={email} onChange={setEmail} autoComplete='email' />
                <Field label='Password' type='password' value={password} onChange={setPassword} autoComplete='new-password' minLength={6} />
                <Field label='Primary coaching goal (optional)' value={primaryGoal} onChange={setPrimaryGoal} placeholder='Develop leadership skills' />
                {error && <ErrorBox message={error} />}
                <button type='submit' disabled={loading} className={`${accentBtn} disabled:opacity-50`}>
                  {loading ? 'Creating account...' : 'Create Candidate Account'}
                </button>
              </form>
            )}
          </>
        )}

        {portal === 'organization' && (
          <>
            <p className='text-sm text-gray-500 text-center mb-4'>
              Organization admin — scores and roster only, no coaching transcripts.
            </p>
            <form onSubmit={handleOrgLogin} className='space-y-4'>
              <Field label='Email' type='email' value={email} onChange={setEmail} autoComplete='email' />
              <Field label='Password' type='password' value={password} onChange={setPassword} autoComplete='current-password' />
              <Field
                label='Organization ID (optional)'
                value={organizationId}
                onChange={setOrganizationId}
                placeholder='Only if you belong to multiple orgs'
              />
              {error && <ErrorBox message={error} />}
              <button type='submit' disabled={loading} className={`${accentBtn} disabled:opacity-50`}>
                {loading ? 'Signing in...' : 'Sign In as Organization'}
              </button>
            </form>
            <p className='text-center text-sm text-gray-500 mt-4'>
              New organization?{' '}
              <Link href='/org/onboarding' className='text-slate-900 underline font-medium'>
                Start onboarding
              </Link>
            </p>
          </>
        )}

        {portal === 'admin' && (
          <>
            <p className='text-sm text-gray-500 text-center mb-4'>
              Platform super-admin access for operations and oversight.
            </p>
            <form onSubmit={handleAdminLogin} className='space-y-4'>
              <Field label='Email' type='email' value={email} onChange={setEmail} autoComplete='email' />
              <Field label='Password' type='password' value={password} onChange={setPassword} autoComplete='current-password' />
              {error && <ErrorBox message={error} />}
              <button type='submit' disabled={loading} className={`${accentBtn} disabled:opacity-50`}>
                {loading ? 'Signing in...' : 'Sign In as Platform Admin'}
              </button>
            </form>
          </>
        )}
          </div>
        </div>
      </section>

      <footer className='landing-footer'>
        © {new Date().getFullYear()} AI Executive Coach · Built for leaders on the rise
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  minLength,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label className='block text-sm font-medium text-gray-700 mb-1'>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
      />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className='alert-error'>{message}</div>;
}
