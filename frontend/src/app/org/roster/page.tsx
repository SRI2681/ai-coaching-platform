'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgNav from '@/components/org-nav';
import { getOrgRoster, type RosterCandidate } from '@/lib/api';

const RISK_STYLES: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  needs_attention: 'bg-amber-100 text-amber-800',
  at_risk: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  baseline_pending: 'Baseline pending',
  assessed: 'Assessed',
  active: 'In coaching',
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

export default function OrgRosterPage() {
  const { adminId, orgId, orgName, ready } = useOrgSession();
  const [candidates, setCandidates] = useState<RosterCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    getOrgRoster(orgId, adminId)
      .then((data) => setCandidates(data.candidates))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load roster.');
      })
      .finally(() => setLoading(false));
  }, [ready, orgId, adminId]);

  return (
    <div className='min-h-screen bg-slate-50'>
      <OrgNav orgName={orgName} />

      <div className='max-w-6xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>Candidate Roster</h1>
        <p className='text-sm text-slate-500 mb-6'>
          Scores and risk flags only — session transcripts and coaching content are private.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-slate-500'>Loading roster...</p>
        ) : candidates.length === 0 ? (
          <div className='bg-white rounded-2xl shadow p-8 text-center text-slate-500'>
            No candidates in this organization yet.
          </div>
        ) : (
          <div className='bg-white rounded-2xl shadow overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-100 text-left'>
                <tr>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Name</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Goal</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Status</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Baseline</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Current</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Progress</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Risk</th>
                  <th className='px-4 py-3 font-semibold text-slate-700'>Stage</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.candidateId} className='border-t border-slate-100'>
                    <td className='px-4 py-3 font-medium text-slate-900'>{c.name}</td>
                    <td className='px-4 py-3 text-slate-600 max-w-[200px] truncate'>
                      {c.goal || '—'}
                      {c.goalIsOrgAssigned && (
                        <span className='ml-1 text-xs text-blue-600'>(org)</span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-slate-600'>
                      {STATUS_LABELS[c.status] || c.status}
                    </td>
                    <td className='px-4 py-3'>{c.baselineScore}</td>
                    <td className='px-4 py-3 font-semibold'>{c.currentScore}</td>
                    <td className='px-4 py-3'>{c.progressPercent}%</td>
                    <td className='px-4 py-3'>
                      <span
                        className={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${
                          RISK_STYLES[c.riskLevel] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.riskLevel.replace('_', ' ')}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-slate-600'>{c.pipelineStage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
