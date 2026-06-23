'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgNav from '@/components/org-nav';
import { getOrgProgressDashboard, type OrgProgressDashboard } from '@/lib/api';

const RISK_STYLES: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  needs_attention: 'bg-amber-100 text-amber-800',
  at_risk: 'bg-red-100 text-red-800',
};

function useOrgSession() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');

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
  }, [router]);

  return { adminId, orgId, orgName, ready: Boolean(adminId && orgId) };
}

export default function OrgProgressPage() {
  const { adminId, orgId, orgName, ready } = useOrgSession();
  const [dashboard, setDashboard] = useState<OrgProgressDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    getOrgProgressDashboard(orgId, adminId)
      .then(setDashboard)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => setLoading(false));
  }, [ready, orgId, adminId]);

  return (
    <div className='min-h-screen bg-slate-50'>
      <OrgNav orgName={orgName} />

      <div className='max-w-6xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>Org-wide progress</h1>
        <p className='text-sm text-slate-500 mb-6'>
          Aggregate coaching outcomes across your leaders. No session transcripts are shown.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-slate-500'>Loading dashboard...</p>
        ) : dashboard ? (
          <div className='space-y-6'>
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
              <MetricCard label='Leaders enrolled' value={String(dashboard.totals.leaders)} />
              <MetricCard label='Baseline completion' value={`${dashboard.completionRate}%`} />
              <MetricCard label='Avg improvement' value={`${dashboard.improvementRate}%`} />
              <MetricCard label='Action plan progress' value={`${dashboard.overallPercent}%`} />
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
              <div className='bg-white rounded-2xl shadow p-5'>
                <h2 className='text-sm font-semibold text-slate-700 mb-3'>Invites</h2>
                <dl className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>Pending</dt>
                    <dd className='font-medium'>{dashboard.totals.pendingInvites}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>Accepted</dt>
                    <dd className='font-medium'>{dashboard.totals.acceptedInvites}</dd>
                  </div>
                </dl>
              </div>
              <div className='bg-white rounded-2xl shadow p-5'>
                <h2 className='text-sm font-semibold text-slate-700 mb-3'>Team averages</h2>
                <dl className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>Baseline score</dt>
                    <dd className='font-medium'>{dashboard.averages.baselineScore}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>Current score</dt>
                    <dd className='font-medium'>{dashboard.averages.currentScore}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>Progress</dt>
                    <dd className='font-medium'>{dashboard.averages.progressPercent}%</dd>
                  </div>
                </dl>
              </div>
              <div className='bg-white rounded-2xl shadow p-5'>
                <h2 className='text-sm font-semibold text-slate-700 mb-3'>Risk summary</h2>
                <dl className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>On track</dt>
                    <dd className='font-medium text-green-700'>{dashboard.totals.onTrack ?? 0}</dd>
                  </div>
                  <div className='flex justify-between'>
                    <dt className='text-slate-500'>At risk</dt>
                    <dd className='font-medium text-red-700'>{dashboard.totals.atRisk ?? 0}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {dashboard.riskAlerts.length > 0 && (
              <section className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-semibold text-slate-900 mb-4'>Risk alerts</h2>
                <ul className='space-y-3'>
                  {dashboard.riskAlerts.map((alert) => (
                    <li
                      key={alert.candidateId}
                      className='flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3'
                    >
                      <div>
                        <span className='font-medium text-slate-800'>{alert.name}</span>
                        <p className='text-xs text-slate-500 mt-0.5'>{alert.reason}</p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          RISK_STYLES[alert.riskLevel] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {alert.riskLevel.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className='bg-white rounded-2xl shadow overflow-hidden'>
              <h2 className='text-lg font-semibold text-slate-900 p-6 pb-0'>Leader progress</h2>
              {dashboard.leaders.length === 0 ? (
                <p className='p-6 text-slate-500 text-sm'>
                  No leaders linked yet.{' '}
                  <a href='/org/onboarding' className='text-slate-900 underline'>
                    Invite employees
                  </a>
                </p>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm mt-4'>
                    <thead className='bg-slate-50 text-slate-600'>
                      <tr>
                        <th className='text-left px-6 py-3 font-medium'>Leader</th>
                        <th className='text-left px-6 py-3 font-medium'>Baseline</th>
                        <th className='text-left px-6 py-3 font-medium'>Current</th>
                        <th className='text-left px-6 py-3 font-medium'>Progress</th>
                        <th className='text-left px-6 py-3 font-medium'>Sessions</th>
                        <th className='text-left px-6 py-3 font-medium'>Risk</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100'>
                      {dashboard.leaders.map((leader) => (
                        <tr key={leader.candidateId}>
                          <td className='px-6 py-3 font-medium text-slate-800'>{leader.name}</td>
                          <td className='px-6 py-3'>{leader.baselineScore}</td>
                          <td className='px-6 py-3'>{leader.currentScore}</td>
                          <td className='px-6 py-3'>{leader.progressPercent}%</td>
                          <td className='px-6 py-3'>{leader.sessionCount}</td>
                          <td className='px-6 py-3'>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded ${
                                RISK_STYLES[leader.riskLevel] || 'bg-slate-100'
                              }`}
                            >
                              {leader.riskLevel.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-white rounded-2xl shadow p-5'>
      <div className='text-2xl font-bold text-slate-900'>{value}</div>
      <div className='text-sm text-slate-500 mt-1'>{label}</div>
    </div>
  );
}
