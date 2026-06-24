'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import { getSessionHistory, type SessionDebrief, type SessionHistoryItem } from '@/lib/api';

function mergeJustEnded(
  sessions: SessionHistoryItem[],
  justEnded: SessionHistoryItem | null
): SessionHistoryItem[] {
  if (!justEnded) return sessions;
  const without = sessions.filter((s) => s.sessionId !== justEnded.sessionId);
  return [justEnded, ...without];
}

function readJustEndedSession(): SessionHistoryItem | null {
  const raw = localStorage.getItem('just_ended_session');
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      sessionId: string;
      recordingUrl?: string | null;
      debrief?: SessionDebrief;
      completedAt?: string;
    };
    const debrief = data.debrief;
    return {
      sessionId: data.sessionId,
      completedAt: data.completedAt || new Date().toISOString(),
      recordingUrl: data.recordingUrl,
      sessionType: 'voice',
      cdlStart: debrief?.cdl_start,
      cdlEnd: debrief?.cdl_end,
      summaryText: debrief?.summary_text,
      keyWin: debrief?.key_win,
      keyGap: debrief?.key_gap,
      actionItem: debrief?.action_item,
      cdlMovement: debrief?.cdl_movement,
    };
  } catch {
    return null;
  }
}

export default function PreviousSessionsPage() {
  return (
    <Suspense fallback={<div className='min-h-screen flex items-center justify-center'>Loading...</div>}>
      <PreviousSessionsInner />
    </Suspense>
  );
}

function PreviousSessionsInner() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSessions = useCallback(async (cid: string, retainJustEnded = true) => {
    const justEnded = retainJustEnded ? readJustEndedSession() : null;
    const data = await getSessionHistory(cid);
    setSessions(mergeJustEnded(data.sessions, justEnded));
    if (justEnded?.recordingUrl) {
      localStorage.removeItem('just_ended_session');
    }
  }, []);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setFirstName(localStorage.getItem('first_name') || 'there');

    loadSessions(cid)
      .catch((err) => {
        const justEnded = readJustEndedSession();
        if (justEnded) {
          setSessions([justEnded]);
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load sessions.');
        }
      })
      .finally(() => setLoading(false));

    // Recording URL may land in DB a few seconds after end — refresh once.
    const refreshTimer = window.setTimeout(() => {
      loadSessions(cid).catch(() => undefined);
    }, 5000);

    return () => window.clearTimeout(refreshTimer);
  }, [router, loadSessions]);

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-4xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>Previous Session Summary</h1>
        <p className='text-gray-500 mb-6'>
          Recordings and debriefs from your completed coaching sessions.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <div className='bg-white rounded-2xl shadow p-8 text-center'>
            <p className='text-gray-600'>No completed sessions yet.</p>
          </div>
        ) : (
          <div className='space-y-6'>
            {sessions.map((session, index) => (
              <SessionCard key={session.sessionId} session={session} isLatest={index === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session, isLatest }: { session: SessionHistoryItem; isLatest?: boolean }) {
  const dateLabel = session.completedAt
    ? new Date(session.completedAt).toLocaleString()
    : 'Completed session';

  return (
    <article
      className={`bg-white rounded-2xl shadow overflow-hidden ${
        isLatest ? 'ring-2 ring-blue-200' : ''
      }`}
    >
      <div className='p-5 border-b border-gray-100'>
        <div className='flex flex-wrap justify-between gap-2'>
          <div>
            {isLatest && (
              <span className='text-xs font-semibold uppercase text-blue-600 mb-1 block'>
                Latest session
              </span>
            )}
            <h2 className='font-semibold text-gray-900 capitalize'>
              {session.sessionType} session · {dateLabel}
            </h2>
          </div>
          {session.cdlStart != null && session.cdlEnd != null && (
            <span className='text-sm text-blue-800 font-medium'>
              CDL {Number(session.cdlStart).toFixed(1)} → {Number(session.cdlEnd).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {session.recordingUrl ? (
        <div className='bg-gray-900 p-4'>
          <video
            controls
            preload='metadata'
            className='w-full max-h-[360px] rounded-lg bg-black'
            src={session.recordingUrl}
          >
            Your browser does not support video playback.
          </video>
          <p className='text-xs text-gray-400 mt-2'>Session recording</p>
        </div>
      ) : (
        <div className='px-5 py-4 bg-gray-50 text-sm text-gray-500 border-b border-gray-100'>
          Recording is still processing. Refresh this page in a moment if you just ended a session.
        </div>
      )}

      <div className='p-5 space-y-3 text-sm'>
        {session.summaryText && (
          <p className='text-gray-700 leading-relaxed'>{session.summaryText}</p>
        )}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          {session.keyWin && (
            <div className='rounded-lg bg-green-50 p-3'>
              <p className='text-xs font-semibold uppercase text-green-700 mb-1'>Key win</p>
              <p className='text-gray-800'>{session.keyWin}</p>
            </div>
          )}
          {session.keyGap && (
            <div className='rounded-lg bg-amber-50 p-3'>
              <p className='text-xs font-semibold uppercase text-amber-700 mb-1'>Area to develop</p>
              <p className='text-gray-800'>{session.keyGap}</p>
            </div>
          )}
        </div>
        {session.actionItem && (
          <div className='rounded-lg bg-blue-50 p-3'>
            <p className='text-xs font-semibold uppercase text-blue-700 mb-1'>Action item</p>
            <p className='text-gray-800'>{session.actionItem}</p>
          </div>
        )}
      </div>
    </article>
  );
}
