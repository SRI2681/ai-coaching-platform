'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell, { PageHeader } from '@/components/page-shell';
import {
  generateReport,
  getProgressMetrics,
  getSavedReport,
  type ProgressChartPoint,
  type ProgressMetrics,
  type ReportPayload,
  type SavedReport,
} from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  midpoint: 'Midpoint',
  final: 'Final',
};

function TrendChart({ points }: { points: ProgressChartPoint[] }) {
  if (!points.length) {
    return (
      <p className='text-sm text-gray-500 text-center py-8'>
        Complete assessments to see your score trend.
      </p>
    );
  }

  const maxScore = Math.max(100, ...points.map((p) => p.score));

  return (
    <div className='flex items-end justify-center gap-6 h-48 pt-4'>
      {points.map((point, idx) => {
        const height = Math.max(8, Math.round((point.score / maxScore) * 100));
        return (
          <div key={`${point.type}-${idx}`} className='flex flex-col items-center gap-2 flex-1 max-w-[80px]'>
            <span className='text-sm font-semibold text-blue-900'>{point.score}</span>
            <div className='w-full flex justify-center items-end h-32'>
              <div
                className='w-10 rounded-t-lg bg-blue-600 transition-all'
                style={{ height: `${height}%` }}
              />
            </div>
            <span className='text-xs text-gray-500 text-center'>
              {TYPE_LABELS[point.type] || point.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReportSection({ payload }: { payload: ReportPayload }) {
  return (
    <div className='space-y-6'>
      <header className='border-b border-gray-200 pb-4'>
        <p className='text-xs font-semibold uppercase text-blue-600 mb-1'>Coaching journey report</p>
        <h2 className='text-xl font-bold text-blue-900'>{payload.goalTitle || 'Coaching Journey'}</h2>
        <p className='text-sm text-gray-500 mt-1'>
          Readiness: {payload.finalReadinessLevel || '—'}
        </p>
      </header>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <ScoreBlock label='Baseline' value={payload.baselineScore} />
        <ScoreBlock label='Current' value={payload.finalScore} />
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
    </div>
  );
}

function ScoreBlock({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
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

export default function ProgressAchievedPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
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

    Promise.all([
      getProgressMetrics(cid),
      getSavedReport(cid).catch(() => null),
    ])
      .then(([progressData, reportData]) => {
        setMetrics(progressData);
        setReport(reportData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load progress.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleGenerateReport() {
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

  const delta = metrics?.scoreDelta ?? 0;
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

  return (
    <PageShell firstName={firstName} wide>
        <div className='print:hidden'>
          <PageHeader
            title='Progress Achieved'
            subtitle={
              metrics?.goalTitle
                ? `Your growth toward: ${metrics.goalTitle}`
                : 'Scores, trends, and your coaching journey report.'
            }
            badge='Your report'
          />
        </div>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading progress...</p>
        ) : metrics ? (
          <div className='space-y-6'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden'>
              <StatCard label='Baseline score' value={String(metrics.baselineScore)} />
              <StatCard label='Current score' value={String(metrics.currentScore)} />
              <StatCard
                label='Improvement'
                value={`${metrics.progressPercent}%`}
                sub={
                  metrics.goalProgressPct != null
                    ? `~${metrics.goalProgressPct}% goal gap closed`
                    : delta !== 0
                      ? `${deltaLabel} pts`
                      : undefined
                }
              />
              <StatCard label='Sessions' value={String(metrics.sessionCount)} />
            </div>

            <div className='bg-white rounded-2xl shadow p-6 print:shadow-none'>
              <h2 className='text-lg font-bold text-blue-900 mb-1'>Assessment trend</h2>
              <p className='text-sm text-gray-500 mb-4'>Score progression across assessments</p>
              <TrendChart points={metrics.progressChart} />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden'>
              <div className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-bold text-blue-900 mb-3'>Action plan completion</h2>
                <p className='text-3xl font-bold text-blue-700 mb-2'>
                  {metrics.actionPlanCompletionPercent}%
                </p>
                <div className='w-full bg-gray-100 rounded-full h-3'>
                  <div
                    className='bg-green-600 h-3 rounded-full transition-all'
                    style={{ width: `${metrics.actionPlanCompletionPercent}%` }}
                  />
                </div>
              </div>

              <div className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-bold text-blue-900 mb-3'>Assessment history</h2>
                {metrics.assessmentTrends.length === 0 ? (
                  <p className='text-sm text-gray-500'>No completed assessments yet.</p>
                ) : (
                  <ul className='space-y-2'>
                    {metrics.assessmentTrends.map((t, i) => (
                      <li
                        key={`${t.type}-${i}`}
                        className='flex justify-between text-sm border-b border-gray-100 pb-2'
                      >
                        <span className='text-gray-700 capitalize'>
                          {TYPE_LABELS[t.type] || t.type}
                          {t.level ? ` · ${t.level}` : ''}
                        </span>
                        <span className='font-semibold text-blue-900'>{t.score ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <section className='bg-white rounded-2xl shadow p-6 print:shadow-none'>
              <div className='flex flex-wrap justify-between items-center gap-3 mb-4 print:hidden'>
                <h2 className='text-lg font-bold text-blue-900'>Journey report</h2>
                <div className='flex flex-wrap gap-2'>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generating}
                    className='bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50'
                  >
                    {generating ? 'Generating...' : report ? 'Regenerate report' : 'Generate report'}
                  </button>
                  {report?.payload && (
                    <button
                      onClick={() => window.print()}
                      className='rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
                    >
                      Print / Save PDF
                    </button>
                  )}
                </div>
              </div>

              {report?.payload ? (
                <ReportSection payload={report.payload} />
              ) : (
                <p className='text-sm text-gray-500 print:hidden'>
                  Generate a report snapshot from your baseline, skill checks, sessions, and action plan.
                </p>
              )}
            </section>

            <button
              onClick={() => router.push('/dashboard')}
              className='btn-primary print:hidden'
            >
              Back to Dashboard
            </button>
          </div>
        ) : null}
    </PageShell>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className='card-premium p-5'>
      <p className='text-xs font-semibold uppercase text-slate-500 mb-1'>{label}</p>
      <p className='text-2xl font-bold text-slate-900 font-display'>{value}</p>
      {sub && <p className='text-sm text-gray-500 mt-1'>{sub}</p>}
    </div>
  );
}
