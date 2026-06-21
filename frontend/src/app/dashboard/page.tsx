'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startSession, startAvatarSession, type SessionDebrief } from '@/lib/api';

const CDL_LABELS = ['', 'Foundation', 'Developing', 'Practitioner', 'Advanced', 'Executive'];
const CDL_COLORS = ['', 'bg-gray-400', 'bg-blue-400', 'bg-blue-600', 'bg-purple-600', 'bg-yellow-500'];

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
  const [framework, setFramework] = useState('GROW');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [lastDebrief, setLastDebrief] = useState<SessionDebrief | null>(null);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setFirstName(localStorage.getItem('first_name') || 'there');
    setCdl(parseFloat(localStorage.getItem('current_cdl') || '1.0'));
    setCoachName(localStorage.getItem('coach_name') || 'Alex');
    setFramework(localStorage.getItem('framework') || 'GROW');
    setLastDebrief(readLastDebrief());
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
      localStorage.removeItem('conversation_url');
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
      const useVoiceFallback = result.fallback_mode || !result.conversation_url;

      localStorage.setItem('session_id', result.session_id);
      localStorage.setItem('framework', result.framework);
      localStorage.setItem('session_type', 'avatar');
      localStorage.setItem('current_cdl', String(result.current_cdl));
      localStorage.setItem('fallback_mode', useVoiceFallback ? 'true' : 'false');

      if (result.conversation_url) {
        localStorage.setItem('conversation_url', result.conversation_url);
      } else {
        localStorage.removeItem('conversation_url');
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
    <div className='min-h-screen bg-gray-50'>
      <nav className='bg-blue-900 text-white px-8 py-4 flex justify-between items-center'>
        <h1 className='text-xl font-bold'>AI Executive Coach</h1>
        <div className='flex items-center gap-4'>
          <span>Welcome, {firstName}</span>
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className='text-blue-300 hover:text-white text-sm'
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className='max-w-4xl mx-auto p-8'>
        <div className='bg-white rounded-2xl shadow p-6 mb-6'>
          <h2 className='text-2xl font-bold text-blue-900 mb-1'>Leader Dashboard</h2>
          <p className='text-gray-500 mb-4'>Your coaching level adapts as you grow.</p>
          <div className='flex items-center gap-4'>
            <div
              className={`w-16 h-16 rounded-full ${CDL_COLORS[cdlBand]} flex items-center justify-center text-white text-2xl font-bold`}
            >
              {cdl.toFixed(1)}
            </div>
            <div>
              <p className='text-lg font-semibold text-gray-800'>
                CDL {cdl.toFixed(1)} — {CDL_LABELS[cdlBand]}
              </p>
              <p className='text-gray-500 text-sm'>Coach: {coachName} · Framework: {framework}</p>
            </div>
          </div>
        </div>

        {lastDebrief?.action_item && (
          <div className='bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6'>
            <p className='text-xs font-semibold uppercase text-amber-700 mb-1'>From your last session</p>
            <p className='text-gray-800 text-sm mb-3'>{lastDebrief.action_item}</p>
            <button
              onClick={() => router.push('/summary')}
              className='text-sm font-semibold text-amber-800 hover:text-amber-900'
            >
              View full session summary →
            </button>
          </div>
        )}

        <h2 className='text-xl font-bold text-gray-800 mb-4'>Start a Coaching Session</h2>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='bg-white rounded-2xl shadow p-6'>
            <h3 className='text-lg font-bold text-blue-900 mb-2'>Voice Session</h3>
            <p className='text-gray-500 text-sm mb-4'>
              Speak with your AI coach. Voice-only, works on any device.
            </p>
            <button
              onClick={handleStartVoice}
              disabled={!!loading}
              className='w-full bg-blue-700 text-white rounded-lg py-3 font-semibold hover:bg-blue-800 disabled:opacity-50'
            >
              {loading === 'voice' ? 'Starting...' : 'Start Voice Session'}
            </button>
          </div>

          <div className='bg-white rounded-2xl shadow p-6'>
            <h3 className='text-lg font-bold text-purple-900 mb-2'>Avatar Session</h3>
            <p className='text-gray-500 text-sm mb-4'>
              Face-to-face with your AI coach. Requires camera and microphone.
            </p>
            <button
              onClick={handleStartAvatar}
              disabled={!!loading}
              className='w-full bg-purple-700 text-white rounded-lg py-3 font-semibold hover:bg-purple-800 disabled:opacity-50'
            >
              {loading === 'avatar' ? 'Starting...' : 'Start Avatar Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
