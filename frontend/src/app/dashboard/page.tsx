'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/page-shell';
import { startSession, startAvatarSession, type SessionDebrief } from '@/lib/api';

const CDL_LABELS = ['', 'Foundation', 'Developing', 'Practitioner', 'Advanced', 'Executive'];
const CDL_GRADIENTS = [
  '',
  'from-slate-500 to-slate-600',
  'from-blue-500 to-indigo-600',
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-amber-400 to-orange-500',
];

const JOURNEY = [
  { step: 1, title: 'Goal Setup', desc: 'Define your leadership focus', href: '/goal-setup' },
  { step: 2, title: 'Baseline', desc: 'AI diagnostic assessment', href: '/assessment' },
  { step: 3, title: 'Action Plan', desc: 'Milestones & exercises', href: '/action-plan' },
  { step: 4, title: 'Skill Check', desc: 'Adaptive progress check', href: '/skill-check' },
  { step: 5, title: 'Progress', desc: 'Scores, trends & report', href: '/progress' },
];

function readLastDebrief(): SessionDebrief | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('last_debrief');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionDebrief;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [cdl, setCdl] = useState(1.0);
  const [coachName, setCoachName] = useState('Alex');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [lastDebrief, setLastDebrief] = useState<SessionDebrief | null>(null);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    function refreshProfile() {
      setFirstName(localStorage.getItem('first_name') || 'there');
      setCdl(parseFloat(localStorage.getItem('current_cdl') || '1.0'));
      setCoachName(localStorage.getItem('coach_name') || 'Alex');
      setLastDebrief(readLastDebrief());
    }
    refreshProfile();
    window.addEventListener('focus', refreshProfile);
    return () => window.removeEventListener('focus', refreshProfile);
  }, [router]);

  const cdlBand = Math.min(5, Math.max(1, Math.floor(cdl)));

  async function handleStartVoice() {
    setLoading('voice');
    setError('');
    try {
      const cid = localStorage.getItem('candidate_id');
      if (!cid) {
        router.push('/');
        return;
      }
      const result = await startSession(cid, 'voice');
      localStorage.setItem('session_id', result.session_id);
      localStorage.setItem('framework', result.framework);
      localStorage.setItem('coach_opening', result.coach_opening);
      localStorage.setItem('session_type', 'voice');
      localStorage.removeItem('anam_session_token');
      localStorage.removeItem('fallback_mode');
      localStorage.removeItem('fallback_reason');
      router.push('/session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start voice session.');
    } finally {
      setLoading('');
    }
  }

  async function handleStartAvatar() {
    setLoading('avatar');
    setError('');
    try {
      const cid = localStorage.getItem('candidate_id');
      if (!cid) {
        router.push('/');
        return;
      }
      const result = await startAvatarSession(cid);
      const useVoiceFallback = result.fallback_mode || !result.session_token;
      localStorage.setItem('session_id', result.session_id);
      localStorage.setItem('framework', result.framework);
      localStorage.setItem('session_type', 'avatar');
      localStorage.setItem('current_cdl', String(result.current_cdl));
      localStorage.setItem('fallback_mode', useVoiceFallback ? 'true' : 'false');
      if (result.session_token) {
        localStorage.setItem('anam_session_token', result.session_token);
      } else {
        localStorage.removeItem('anam_session_token');
      }
      if (result.fallback_reason) {
        localStorage.setItem('fallback_reason', result.fallback_reason);
      } else {
        localStorage.removeItem('fallback_reason');
      }
      localStorage.removeItem('coach_opening');
      router.push('/session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start avatar session.');
    } finally {
      setLoading('');
    }
  }

  return (
    <PageShell firstName={firstName} wide>
      {/* Hero welcome */}
      <div className='card-hero p-8 md:p-10 mb-8 relative'>
        <div className='relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6'>
          <div>
            <span className='badge badge-gold mb-4'>Your executive practice studio</span>
            <h1 className='font-display text-3xl md:text-4xl font-bold tracking-tight mb-2'>
              Welcome back, {firstName}
            </h1>
            <p className='text-white/75 text-lg max-w-xl'>
              Every session is a rehearsal for the room you&apos;re stepping into. Pick up where you left off.
            </p>
          </div>
          <div className='flex items-center gap-5 shrink-0'>
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${CDL_GRADIENTS[cdlBand]} flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white/20`}
            >
              {cdl.toFixed(1)}
            </div>
            <div>
              <p className='text-white/60 text-sm font-medium uppercase tracking-wider'>Coaching Level</p>
              <p className='text-xl font-semibold'>
                CDL {cdl.toFixed(1)} — {CDL_LABELS[cdlBand]}
              </p>
              <p className='text-white/60 text-sm mt-0.5'>Coach: {coachName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Journey */}
      <section className='mb-8'>
        <div className='flex items-end justify-between mb-5'>
          <div>
            <h2 className='font-display text-xl font-bold text-[var(--brand-navy)]'>Your coaching journey</h2>
            <p className='text-slate-500 text-sm mt-1'>Five steps to measurable leadership growth</p>
          </div>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
          {JOURNEY.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className='journey-card'
            >
              <span className='journey-step-num'>{item.step}</span>
              <p className='font-semibold text-slate-800 text-sm'>{item.title}</p>
              <p className='text-xs text-slate-500 mt-1 leading-snug'>{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {lastDebrief?.action_item && (
        <div className='card-glass p-5 mb-8 border-l-4 border-l-amber-400'>
          <p className='badge badge-gold mb-2'>From your last session</p>
          <p className='text-slate-700 text-sm mb-3 leading-relaxed'>{lastDebrief.action_item}</p>
          <button
            onClick={() => router.push('/summary')}
            className='text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors'
          >
            View session summary →
          </button>
        </div>
      )}

      {/* Start session */}
      <section>
        <div className='mb-5'>
          <h2 className='font-display text-xl font-bold text-[var(--brand-navy)]'>Start a coaching session</h2>
          <p className='text-slate-500 text-sm mt-1'>
            Rehearse the conversations that define your next promotion — board reviews, feedback, influence
          </p>
        </div>

        {error && <div className='alert-error mb-4'>{error}</div>}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
          <div className='card-premium overflow-hidden group'>
            <div className='h-2 bg-gradient-to-r from-indigo-500 to-indigo-600' />
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-3'>
                <span className='w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600'>
                  <MicIcon />
                </span>
                <h3 className='font-display text-lg font-bold text-slate-900'>Voice Session</h3>
              </div>
              <p className='text-slate-500 text-sm mb-5 leading-relaxed'>
                Speak naturally with your AI coach. Voice-only — works on any device, anywhere.
              </p>
              <button
                onClick={handleStartVoice}
                disabled={!!loading}
                className='btn-primary'
              >
                {loading === 'voice' ? 'Starting...' : 'Start Voice Session'}
              </button>
            </div>
          </div>

          <div className='card-premium overflow-hidden group'>
            <div className='h-2 bg-gradient-to-r from-violet-500 to-purple-600' />
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-3'>
                <span className='w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600'>
                  <VideoIcon />
                </span>
                <h3 className='font-display text-lg font-bold text-slate-900'>Avatar Session</h3>
              </div>
              <p className='text-slate-500 text-sm mb-5 leading-relaxed'>
                Face-to-face with your AI coach avatar. Requires camera and microphone.
              </p>
              <button
                onClick={handleStartAvatar}
                disabled={!!loading}
                className='btn-primary btn-accent-violet'
              >
                {loading === 'avatar' ? 'Starting...' : 'Start Avatar Session'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function MicIcon() {
  return (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
      <path d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' />
      <path d='M19 10v2a7 7 0 0 1-14 0v-2M12 19v3' />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
      <rect x='2' y='5' width='14' height='14' rx='2' />
      <path d='m22 7-6 4 6 4V7Z' />
    </svg>
  );
}
