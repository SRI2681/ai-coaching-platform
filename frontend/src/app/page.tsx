'use client';

import { useEffect, useState, useCallback, type FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LandingHeader from '@/components/landing/landing-header';
import ScenarioPreview from '@/components/landing/scenario-preview';
import HowItWorks from '@/components/landing/how-it-works';
import AuthModal, { type AuthMode, type PortalType } from '@/components/landing/auth-modal';
import {
  acceptInvite,
  loginCandidate,
  loginOrgAdmin,
  loginPlatformAdmin,
  lookupInvite,
  registerCandidate,
} from '@/lib/api';

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

  const [authOpen, setAuthOpen] = useState(false);
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

  const openAuth = useCallback(
    (opts?: { mode?: AuthMode; portal?: PortalType }) => {
      if (opts?.portal) setPortal(opts.portal);
      if (opts?.mode) setMode(opts.mode);
      setError('');
      setAuthOpen(true);
    },
    []
  );

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setError('');
  }, []);

  function switchPortal(next: PortalType) {
    setPortal(next);
    setError('');
    if (next !== 'candidate') setMode('login');
  }

  useEffect(() => {
    if (portalParam === 'organization' || portalParam === 'admin' || portalParam === 'candidate') {
      openAuth({ portal: portalParam, mode: 'login' });
    }
  }, [portalParam, openAuth]);

  useEffect(() => {
    if (!inviteToken) return;
    lookupInvite(inviteToken)
      .then((inv) => {
        setOrgName(inv.org_name);
        setEmail(inv.email);
        openAuth({ portal: 'candidate', mode: 'signup' });
      })
      .catch(() => undefined);
  }, [inviteToken, openAuth]);

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

  return (
    <div className='landing-page'>
      <LandingHeader
        onSignIn={() => openAuth({ mode: 'login', portal: 'candidate' })}
        onGetStarted={() => openAuth({ mode: 'signup', portal: 'candidate' })}
        onOrgSignIn={() => openAuth({ mode: 'login', portal: 'organization' })}
      />

      <section className='landing-hero'>
        <div className='landing-hero-badge'>For aspiring executives</div>
        <h1 className='landing-hero-title'>
          Rehearse the conversations that{' '}
          <span className='landing-hero-accent'>define your career</span>
        </h1>
        <p className='landing-hero-sub'>
          AI coaching for boardroom moments, difficult feedback, and stakeholder influence —
          scored, debriefed, and tied to a measurable growth plan.
        </p>
        <div className='landing-hero-wrap'>
          <ScenarioPreview onStart={() => openAuth({ mode: 'signup', portal: 'candidate' })} />
        </div>

        <div className='landing-trust-row'>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>5</div>
            <div className='landing-trust-label'>CDL levels</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>9+</div>
            <div className='landing-trust-label'>Frameworks</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>Live</div>
            <div className='landing-trust-label'>Voice & avatar</div>
          </div>
          <div className='landing-trust-item'>
            <div className='landing-trust-val'>30d</div>
            <div className='landing-trust-label'>Action plans</div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <footer className='landing-footer'>
        © {new Date().getFullYear()} AI Executive Coach · Built for leaders on the rise
      </footer>

      <AuthModal
        open={authOpen}
        onClose={closeAuth}
        portal={portal}
        onPortalChange={switchPortal}
        mode={mode}
        onModeChange={(m) => { setMode(m); setError(''); }}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        organizationId={organizationId}
        onOrganizationIdChange={setOrganizationId}
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
        primaryGoal={primaryGoal}
        onPrimaryGoalChange={setPrimaryGoal}
        orgName={orgName}
        error={error}
        loading={loading}
        onCandidateLogin={handleCandidateLogin}
        onCandidateSignup={handleCandidateSignup}
        onOrgLogin={handleOrgLogin}
        onAdminLogin={handleAdminLogin}
      />
    </div>
  );
}
