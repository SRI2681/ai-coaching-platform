'use client';

import { useEffect, type FormEvent } from 'react';
import Link from 'next/link';

export type PortalType = 'candidate' | 'organization' | 'admin';
export type AuthMode = 'login' | 'signup';

const PORTALS: { id: PortalType; label: string; description: string }[] = [
  { id: 'candidate', label: 'Leader', description: 'Coaching candidate' },
  { id: 'organization', label: 'Organization', description: 'HR & program admin' },
  { id: 'admin', label: 'Platform', description: 'Operations admin' },
];

const PORTAL_COPY: Record<PortalType, { title: string; blurb: string }> = {
  candidate: {
    title: 'Step into the room before it counts',
    blurb: 'Practice board reviews, tough feedback, and stakeholder conversations with an AI coach that scores your growth.',
  },
  organization: {
    title: 'Measure leadership growth across your bench',
    blurb: 'Roster visibility, progress scores, and program analytics — without access to private coaching transcripts.',
  },
  admin: {
    title: 'Platform operations & oversight',
    blurb: 'Manage organizations, monitor system health, and support enterprise coaching programs.',
  },
};

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  portal: PortalType;
  onPortalChange: (p: PortalType) => void;
  mode: AuthMode;
  onModeChange: (m: AuthMode) => void;
  email: string;
  onEmailChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  organizationId: string;
  onOrganizationIdChange: (v: string) => void;
  firstName: string;
  onFirstNameChange: (v: string) => void;
  lastName: string;
  onLastNameChange: (v: string) => void;
  primaryGoal: string;
  onPrimaryGoalChange: (v: string) => void;
  orgName: string;
  error: string;
  loading: boolean;
  onCandidateLogin: (e: FormEvent<HTMLFormElement>) => void;
  onCandidateSignup: (e: FormEvent<HTMLFormElement>) => void;
  onOrgLogin: (e: FormEvent<HTMLFormElement>) => void;
  onAdminLogin: (e: FormEvent<HTMLFormElement>) => void;
}

export default function AuthModal(props: AuthModalProps) {
  const { open, onClose, portal, onPortalChange } = props;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const copy = PORTAL_COPY[portal];

  return (
    <div className='auth-modal-overlay' role='dialog' aria-modal='true' aria-labelledby='auth-modal-title'>
      <button type='button' className='auth-modal-backdrop' onClick={onClose} aria-label='Close' />
      <div className='auth-modal-panel'>
        <div className='auth-modal-grid'>
          <aside className='auth-modal-brand'>
            <button type='button' onClick={onClose} className='auth-back-home'>
              ← Back to home
            </button>
            <div className='auth-brand-content'>
              <span className='auth-brand-eyebrow'>AI Executive Coach</span>
              <h2 id='auth-modal-title' className='auth-brand-title'>
                {copy.title}
              </h2>
              <p className='auth-brand-blurb'>{copy.blurb}</p>
            </div>
            <div className='auth-brand-footer'>
              <span className='auth-brand-stat'>
                <strong>5</strong> CDL levels
              </span>
              <span className='auth-brand-stat'>
                <strong>9+</strong> frameworks
              </span>
            </div>
          </aside>

          <main className='auth-modal-form-area'>
            <div className='auth-modal-form-header'>
              <h3 className='auth-form-title'>Access your account</h3>
              <button type='button' onClick={onClose} className='auth-modal-close' aria-label='Close'>
                ×
              </button>
            </div>

            <div className='auth-portal-tabs' role='tablist'>
              {PORTALS.map((p) => (
                <button
                  key={p.id}
                  type='button'
                  role='tab'
                  aria-selected={portal === p.id}
                  onClick={() => onPortalChange(p.id)}
                  className={`auth-portal-tab ${portal === p.id ? 'auth-portal-tab-active' : ''}`}
                >
                  <span className='auth-portal-tab-label'>{p.label}</span>
                  <span className='auth-portal-tab-desc'>{p.description}</span>
                </button>
              ))}
            </div>

            {portal === 'candidate' && <CandidateForms {...props} />}
            {portal === 'organization' && <OrganizationForm {...props} />}
            {portal === 'admin' && <AdminForm {...props} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function CandidateForms(props: AuthModalProps) {
  const {
    mode,
    onModeChange,
    orgName,
    error,
    loading,
    onCandidateLogin,
    onCandidateSignup,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    firstName,
    onFirstNameChange,
    lastName,
    onLastNameChange,
    primaryGoal,
    onPrimaryGoalChange,
  } = props;

  return (
    <>
      <p className='auth-form-hint'>
        {orgName
          ? `Join ${orgName}'s coaching program`
          : mode === 'login'
            ? 'Welcome back — sign in to continue practicing'
            : 'Create your leader profile to begin'}
      </p>

      <div className='auth-mode-toggle'>
        <button
          type='button'
          onClick={() => onModeChange('login')}
          className={mode === 'login' ? 'auth-mode-active' : ''}
        >
          Sign in
        </button>
        <button
          type='button'
          onClick={() => onModeChange('signup')}
          className={mode === 'signup' ? 'auth-mode-active' : ''}
        >
          Create account
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={onCandidateLogin} className='auth-form-fields'>
          <Field label='Email' type='email' value={email} onChange={onEmailChange} autoComplete='email' />
          <Field
            label='Password'
            type='password'
            value={password}
            onChange={onPasswordChange}
            autoComplete='current-password'
          />
          {error && <ErrorBox message={error} />}
          <button type='submit' disabled={loading} className='btn-auth-submit'>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className='auth-form-footnote'>
            Invited by your company? Use <strong>Create account</strong> to set your password first.
          </p>
        </form>
      ) : (
        <form onSubmit={onCandidateSignup} className='auth-form-fields'>
          <div className='auth-form-row'>
            <Field label='First name' value={firstName} onChange={onFirstNameChange} autoComplete='given-name' />
            <Field label='Last name' value={lastName} onChange={onLastNameChange} autoComplete='family-name' />
          </div>
          <Field label='Email' type='email' value={email} onChange={onEmailChange} autoComplete='email' />
          <Field
            label='Password'
            type='password'
            value={password}
            onChange={onPasswordChange}
            autoComplete='new-password'
            minLength={6}
          />
          <Field
            label='Coaching focus (optional)'
            value={primaryGoal}
            onChange={onPrimaryGoalChange}
            placeholder='e.g. Executive presence'
            required={false}
          />
          {error && <ErrorBox message={error} />}
          <button type='submit' disabled={loading} className='btn-auth-submit'>
            {loading ? 'Creating account...' : 'Create account & begin'}
          </button>
        </form>
      )}
    </>
  );
}

function OrganizationForm(props: AuthModalProps) {
  const {
    error,
    loading,
    onOrgLogin,
    email,
    onEmailChange,
    password,
    onPasswordChange,
    organizationId,
    onOrganizationIdChange,
    onClose,
  } = props;

  return (
    <>
      <p className='auth-form-hint'>
        Organization admin — roster, scores, and progress. No private session transcripts.
      </p>
      <form onSubmit={onOrgLogin} className='auth-form-fields'>
        <Field label='Email' type='email' value={email} onChange={onEmailChange} autoComplete='email' />
        <Field
          label='Password'
          type='password'
          value={password}
          onChange={onPasswordChange}
          autoComplete='current-password'
        />
        <Field
          label='Organization ID (optional)'
          value={organizationId}
          onChange={onOrganizationIdChange}
          placeholder='Only if you belong to multiple orgs'
          required={false}
        />
        {error && <ErrorBox message={error} />}
        <button type='submit' disabled={loading} className='btn-auth-submit'>
          {loading ? 'Signing in...' : 'Sign in to organization'}
        </button>
        <p className='auth-form-footnote text-center'>
          New organization?{' '}
          <Link
            href='/org/onboarding'
            onClick={onClose}
            className='auth-inline-link'
          >
            Start onboarding
          </Link>
        </p>
      </form>
    </>
  );
}

function AdminForm(props: AuthModalProps) {
  const { error, loading, onAdminLogin, email, onEmailChange, password, onPasswordChange } = props;

  return (
    <>
      <p className='auth-form-hint'>Platform super-admin access for operations and oversight.</p>
      <form onSubmit={onAdminLogin} className='auth-form-fields'>
        <Field label='Email' type='email' value={email} onChange={onEmailChange} autoComplete='email' />
        <Field
          label='Password'
          type='password'
          value={password}
          onChange={onPasswordChange}
          autoComplete='current-password'
        />
        {error && <ErrorBox message={error} />}
        <button type='submit' disabled={loading} className='btn-auth-submit'>
          {loading ? 'Signing in...' : 'Sign in as platform admin'}
        </button>
      </form>
    </>
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
      <label className='auth-field-label'>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='input-premium'
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
