'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgNav from '@/components/org-nav';
import { getOrgPipeline, type OrgPipeline } from '@/lib/api';

const STAGE_COLORS: Record<string, string> = {
  Emerging: 'border-l-amber-500',
  Developing: 'border-l-blue-500',
  Ready: 'border-l-green-600',
};

const RISK_STYLES: Record<string, string> = {
  on_track: 'text-green-700',
  needs_attention: 'text-amber-700',
  at_risk: 'text-red-700',
};

export default function OrgPipelinePage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [pipeline, setPipeline] = useState<OrgPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const aid = localStorage.getItem('org_admin_id');
    const oid = localStorage.getItem('org_id');
    if (!aid || !oid) {
      router.push('/org/login');
      return;
    }
    setAdminId(aid);
    setOrgId(oid);
    setOrgName(localStorage.getItem('org_name') || '');

    getOrgPipeline(oid, aid)
      .then(setPipeline)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load pipeline.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const metrics = pipeline?.metrics;
  const stageOrder = ['Emerging', 'Developing', 'Ready'];

  return (
    <div className='min-h-screen bg-slate-50'>
      <OrgNav orgName={orgName} />

      <div className='max-w-6xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>Leader Pipeline</h1>
        <p className='text-sm text-slate-500 mb-6'>
          Future-leader pipeline by stage — aggregate scores only, no coaching transcripts.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-slate-500'>Loading pipeline...</p>
        ) : pipeline ? (
          <div className='space-y-6'>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
              <MetricCard label='Total leaders' value={String(metrics?.totalLeaders ?? 0)} />
              <MetricCard label='On track' value={`${metrics?.onTrackPercent ?? 0}%`} />
              <MetricCard label='Ready' value={String(metrics?.readyCount ?? 0)} />
              <MetricCard label='At risk' value={String(metrics?.atRiskTotal ?? 0)} />
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
              {stageOrder.map((stageName) => {
                const stage = pipeline.stages[stageName];
                if (!stage) return null;
                return (
                  <div
                    key={stageName}
                    className={`bg-white rounded-2xl shadow border-l-4 ${STAGE_COLORS[stageName]} p-5`}
                  >
                    <div className='flex justify-between items-start mb-4'>
                      <div>
                        <h2 className='text-lg font-bold text-slate-900'>{stageName}</h2>
                        <p className='text-sm text-slate-500'>
                          {stage.count} leaders · avg {stage.avgScore}
                        </p>
                      </div>
                      {stage.atRiskCount > 0 && (
                        <span className='text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded'>
                          {stage.atRiskCount} at risk
                        </span>
                      )}
                    </div>
                    {stage.candidates.length === 0 ? (
                      <p className='text-sm text-slate-400'>No leaders in this stage.</p>
                    ) : (
                      <ul className='space-y-2'>
                        {stage.candidates.map((c) => (
                          <li
                            key={c.candidateId}
                            className='flex justify-between text-sm border-b border-slate-100 pb-2'
                          >
                            <span className='text-slate-800'>{c.name}</span>
                            <span className='text-right'>
                              <span className='font-semibold text-slate-900'>{c.currentScore}</span>
                              <span
                                className={`block text-xs capitalize ${RISK_STYLES[c.riskLevel] || ''}`}
                              >
                                {c.riskLevel.replace('_', ' ')}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-white rounded-2xl shadow p-5'>
      <p className='text-xs font-semibold uppercase text-slate-500 mb-1'>{label}</p>
      <p className='text-2xl font-bold text-slate-900'>{value}</p>
    </div>
  );
}
