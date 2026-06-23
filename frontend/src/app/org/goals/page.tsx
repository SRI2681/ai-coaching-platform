'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgNav from '@/components/org-nav';
import {
  ORG_GOAL_THEMES,
  assignOrgGoal,
  getOrgRoster,
  type RosterCandidate,
} from '@/lib/api';

export default function OrgGoalAssignmentPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [candidates, setCandidates] = useState<RosterCandidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState(ORG_GOAL_THEMES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    getOrgRoster(oid, aid)
      .then((data) => {
        setCandidates(data.candidates);
        if (data.candidates[0]) {
          setCandidateId(data.candidates[0].candidateId);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load candidates.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleAssign() {
    if (!candidateId || !title.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await assignOrgGoal(orgId, {
        admin_id: adminId,
        candidate_id: candidateId,
        title: title.trim(),
        description: description.trim() || undefined,
        theme,
      });
      setSuccess('Goal assigned. The candidate will see it as read-only in Goal Setup.');
      setTitle('');
      setDescription('');
      const refreshed = await getOrgRoster(orgId, adminId);
      setCandidates(refreshed.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign goal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='min-h-screen bg-slate-50'>
      <OrgNav orgName={orgName} />

      <div className='max-w-2xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>Goal Assignment</h1>
        <p className='text-sm text-slate-500 mb-6'>
          Assign organization goals to leaders. Assigned goals are read-only for candidates.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}
        {success && (
          <div className='mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800'>
            {success}
          </div>
        )}

        {loading ? (
          <p className='text-slate-500'>Loading...</p>
        ) : candidates.length === 0 ? (
          <div className='bg-white rounded-2xl shadow p-8 text-center text-slate-500'>
            Add candidates to your organization before assigning goals.
          </div>
        ) : (
          <div className='bg-white rounded-2xl shadow p-6 space-y-5'>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Candidate</label>
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              >
                {candidates.map((c) => (
                  <option key={c.candidateId} value={c.candidateId}>
                    {c.name} — {c.pipelineStage}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Goal title</label>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
                placeholder='e.g. Lead the regional transformation initiative'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              >
                {ORG_GOAL_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssign}
              disabled={saving || !title.trim()}
              className='w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
            >
              {saving ? 'Assigning...' : 'Assign goal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
