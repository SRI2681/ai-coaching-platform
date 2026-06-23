'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import {
  generateReport,
  getSavedReport,
  type ReportPayload,
  type SavedReport,
} from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  midpoint: 'Midpoint',
  final: 'Final',
};

function ReportBody({ payload }: { payload: ReportPayload }) {
  return (
    <div className='space-y-6 print:space-y-4'>
      <header className='border-b border-gray-200 pb-4'>
        <p className='text-xs font-semibold uppercase text-blue-600 mb-1'>Final Coaching Report</p>
        <h2 className='text-xl font-bold text-blue-900'>{payload.goalTitle || 'Coaching Journey'}</h2>
        <p className='text-sm text-gray-500 mt-1'>
          Readiness: {payload.finalReadinessLevel || '—'}
        </p>
      </header>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <ScoreBlock label='Baseline' value={payload.baselineScore} />
        <ScoreBlock label='Final' value={payload.finalScore} />
        <ScoreBlock
          label='Change'
          value={payload.scoreDelta ?? payload.finalScore - payload.baselineScore}
          suffix='pts'
        />
      </div>

      {payload.summary && (
        <section>
          <h3 className='text-sm font-semibold uppercase text-gray-500 mb-2'>Summary</h3>
          <p className='text-gray-800 leading-relaxed'>{payload.summary}</p>
        </section>
      )}

      {payload.assessmentResults.length > 0 && (
        <section>
          <h3 className='text-sm font-semibold uppercase text-gray-500 mb-2'>Assessment results</h3>
          <ul className='space-y-1'>
            {payload.assessmentResults.map((r, i) => (
              <li key={`${r.type}-${i}`} className='flex justify-between text-sm'>
                <span className='text-gray-700 capitalize'>
                  {TYPE_LABELS[r.type] || r.type}
                </span>
                <span className='font-semibold'>{r.score ?? '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.progressChart.length > 0 && (
        <section>
          <h3 className='text-sm font-semibold uppercase text-gray-500 mb-2'>Progress chart</h3>
          <div className='flex items-end gap-4 h-32'>
            {payload.progressChart.map((point, idx) => {
              const height = Math.max(8, point.score);
              return (
                <div key={`${point.type}-${idx}`} className='flex flex-col items-center gap-1 flex-1'>
                  <span className='text-xs font-semibold'>{point.score}</span>
                  <div
                    className='w-full max-w-[48px] bg-blue-500 rounded-t'
                    style={{ height: `${height}%`, minHeight: '8px' }}
                  />
                  <span className='text-xs text-gray-500 capitalize'>{point.type}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <section className='rounded-lg bg-green-50 p-4'>
          <h3 className='text-sm font-semibold uppercase text-green-700 mb-2'>Strengths</h3>
          <ul className='text-sm text-gray-800 list-disc pl-4 space-y-1'>
            {payload.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section className='rounded-lg bg-amber-50 p-4'>
          <h3 className='text-sm font-semibold uppercase text-amber-700 mb-2'>Development areas</h3>
          <ul className='text-sm text-gray-800 list-disc pl-4 space-y-1'>
            {payload.developmentAreas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      </div>

      {(payload.sessionCount != null || payload.actionPlanCompletionPercent != null) && (
        <footer className='text-sm text-gray-500 border-t border-gray-100 pt-4'>
          {payload.sessionCount != null && <span>{payload.sessionCount} sessions completed</span>}
          {payload.sessionCount != null && payload.actionPlanCompletionPercent != null && ' · '}
          {payload.actionPlanCompletionPercent != null && (
            <span>{payload.actionPlanCompletionPercent}% action plan complete</span>
          )}
        </footer>
      )}
    </div>
  );
}

function ScoreBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className='rounded-lg border border-gray-200 p-4 text-center'>
      <p className='text-xs uppercase text-gray-500'>{label}</p>
      <p className='text-2xl font-bold text-blue-900'>
        {value}
        {suffix && <span className='text-sm font-normal text-gray-500 ml-1'>{suffix}</span>}
      </p>
    </div>
  );
}

export default function FinalReportPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setCandidateId(cid);
    setFirstName(localStorage.getItem('first_name') || 'there');

    getSavedReport(cid)
      .then(setReport)
      .catch((err) => {
        const message = err instanceof Error ? err.message : '';
        if (!message.includes('No saved report')) {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleGenerate() {
    if (!candidateId) return;
    setGenerating(true);
    setError('');
    try {
      const saved = await generateReport(candidateId);
      setReport(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate report.');
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className='min-h-screen bg-gray-50 print:bg-white'>
      <div className='print:hidden'>
        <AppNav firstName={firstName} />
      </div>

      <div className='max-w-3xl mx-auto p-8 print:p-0'>
        <div className='print:hidden mb-6'>
          <h1 className='text-2xl font-bold text-blue-900 mb-1'>Final Report</h1>
          <p className='text-gray-500'>
            Saved report snapshot — rendered from stored JSON for fast, consistent display.
          </p>
        </div>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading report...</p>
        ) : report?.payload ? (
          <div className='space-y-4'>
            <div className='print:hidden flex flex-wrap gap-3'>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className='bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50'
              >
                {generating ? 'Regenerating...' : 'Regenerate report'}
              </button>
              <button
                onClick={handlePrint}
                className='rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 hover:bg-gray-50'
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => router.push('/progress')}
                className='rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 hover:bg-gray-50'
              >
                Progress dashboard
              </button>
            </div>

            {report.created_at && (
              <p className='text-xs text-gray-400 print:hidden'>
                Generated {new Date(report.created_at).toLocaleString()}
              </p>
            )}

            <article className='bg-white rounded-2xl shadow p-8 print:shadow-none print:rounded-none'>
              <ReportBody payload={report.payload} />
            </article>
          </div>
        ) : (
          <div className='bg-white rounded-2xl shadow p-8 text-center'>
            <p className='text-gray-600 mb-4'>
              No final report saved yet. Generate one from your coaching progress.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className='bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-50'
            >
              {generating ? 'Generating...' : 'Generate Final Report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
