'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import { getProgressMetrics, type ProgressChartPoint, type ProgressMetrics } from '@/lib/api';

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

export default function ProgressDashboardPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setFirstName(localStorage.getItem('first_name') || 'there');

    getProgressMetrics(cid)
      .then(setMetrics)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load progress.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const delta = metrics?.scoreDelta ?? 0;
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-4xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>Progress Dashboard</h1>
        <p className='text-gray-500 mb-6'>
          {metrics?.goalTitle
            ? `Tracking progress toward: ${metrics.goalTitle}`
            : 'Your coaching journey at a glance.'}
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading progress...</p>
        ) : metrics ? (
          <div className='space-y-6'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
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

            <div className='bg-white rounded-2xl shadow p-6'>
              <h2 className='text-lg font-bold text-blue-900 mb-1'>Assessment trend</h2>
              <p className='text-sm text-gray-500 mb-4'>Score progression across assessments</p>
              <TrendChart points={metrics.progressChart} />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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

            <div className='flex gap-3'>
              <button
                onClick={() => router.push('/report')}
                className='flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold'
              >
                View Final Report
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className='px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50'
              >
                Dashboard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className='bg-white rounded-2xl shadow p-5'>
      <p className='text-xs font-semibold uppercase text-gray-500 mb-1'>{label}</p>
      <p className='text-2xl font-bold text-blue-900'>{value}</p>
      {sub && <p className='text-sm text-gray-500 mt-1'>{sub}</p>}
    </div>
  );
}
