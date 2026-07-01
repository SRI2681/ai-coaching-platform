'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageShell, { PageHeader } from '@/components/page-shell';
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
    <PageShell firstName={firstName}>
        <PageHeader
          title='Previous Session Summary'
          subtitle='Recordings and debriefs from your completed coaching sessions.'
          badge='Session history'
        />

        {error && <div className='alert-error mb-4'>{error}</div>}

        {loading ? (
          <p className='text-slate-500'>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <div className='card-premium p-10 text-center'>
            <p className='text-slate-600'>No completed sessions yet.</p>
          </div>
        ) : (
          <div className='space-y-6'>
            {sessions.map((session, index) => (
              <SessionCard key={session.sessionId} session={session} isLatest={index === 0} />
            ))}
          </div>
        )}
    </PageShell>
  );
}

function SessionCard({ session, isLatest }: { session: SessionHistoryItem; isLatest?: boolean }) {
  const dateLabel = session.completedAt
    ? new Date(session.completedAt).toLocaleString()
    : 'Completed session';

  return (
    <article
      className={`card-premium overflow-hidden ${
        isLatest ? 'ring-2 ring-indigo-300' : ''
      }`}
    >
      <div className='p-5 border-b border-slate-100'>
        <div className='flex flex-wrap justify-between gap-2'>
          <div>
            {isLatest && (
              <span className='badge badge-indigo mb-2'>Latest session</span>
            )}
            <h2 className='font-display font-semibold text-slate-900 capitalize'>
              {session.sessionType} session · {dateLabel}
            </h2>
          </div>
          {session.cdlStart != null && session.cdlEnd != null && (
            <span className='text-sm text-indigo-700 font-semibold bg-indigo-50 px-3 py-1 rounded-full'>
              CDL {Number(session.cdlStart).toFixed(1)} → {Number(session.cdlEnd).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {session.recordingUrl ? (
        <div className='bg-slate-900 p-4'>
          <video
            controls
            preload='metadata'
            className='w-full max-h-[360px] rounded-xl bg-black'
            src={session.recordingUrl}
          >
            Your browser does not support video playback.
          </video>
          <p className='text-xs text-slate-400 mt-2'>Session recording</p>
        </div>
      ) : (
        <div className='px-5 py-4 bg-slate-50 text-sm text-slate-500 border-b border-slate-100'>
          Recording is still processing. Refresh this page in a moment if you just ended a session.
        </div>
      )}

      <div className='p-5 space-y-3 text-sm'>
        {session.summaryText && (
          <p className='text-slate-700 leading-relaxed'>{session.summaryText}</p>
        )}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          {session.keyWin && (
            <div className='rounded-xl bg-emerald-50 border border-emerald-100 p-4'>
              <p className='text-xs font-semibold uppercase text-emerald-700 mb-1'>Key win</p>
              <p className='text-slate-800'>{session.keyWin}</p>
            </div>
          )}
          {session.keyGap && (
            <div className='rounded-xl bg-amber-50 border border-amber-100 p-4'>
              <p className='text-xs font-semibold uppercase text-amber-700 mb-1'>Area to develop</p>
              <p className='text-slate-800'>{session.keyGap}</p>
            </div>
          )}
        </div>
        {session.actionItem && (
          <div className='rounded-xl bg-indigo-50 border border-indigo-100 p-4'>
            <p className='text-xs font-semibold uppercase text-indigo-700 mb-1'>Action item</p>
            <p className='text-slate-800'>{session.actionItem}</p>
          </div>
        )}
      </div>
    </article>
  );
}
