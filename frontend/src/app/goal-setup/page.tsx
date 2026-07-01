'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell, { PageHeader } from '@/components/page-shell';
import {
  createGoal,
  getCandidateGoals,
  updateGoal,
  type CandidateGoal,
} from '@/lib/api';

const THEMES = [
  'Executive Presence',
  'Strategic Influence',
  'Operational Excellence',
  'Team Leadership',
  'Communication',
];

export default function GoalSetupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [goal, setGoal] = useState<CandidateGoal | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState(THEMES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const readOnly = Boolean(goal?.is_org_assigned);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setCandidateId(cid);
    setFirstName(localStorage.getItem('first_name') || 'there');

    getCandidateGoals(cid)
      .then((goals) => {
        const active = goals[0] ?? null;
        setGoal(active);
        if (active) {
          setTitle(active.title || active.goal_text || '');
          setDescription(active.description || '');
          setTheme(active.theme || THEMES[0]);
        } else {
          setTitle(localStorage.getItem('primary_goal') || '');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load goals.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    if (readOnly || !candidateId) return;
    setSaving(true);
    setError('');
    try {
      let saved: CandidateGoal;
      if (goal?.id) {
        saved = await updateGoal(goal.id, { title, description, theme });
      } else {
        saved = await createGoal({ candidate_id: candidateId, title, description, theme });
      }
      setGoal(saved);
      localStorage.setItem('active_goal_id', saved.id);
      localStorage.setItem('active_goal_title', saved.title || saved.goal_text || title);
      router.push('/assessment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save goal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell firstName={firstName}>
        <PageHeader
          title='Goal Setup'
          subtitle='Define what you want to achieve in this coaching program.'
        />

        {readOnly && (
          <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
            This goal was assigned by your organization and cannot be edited.
          </div>
        )}

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading your goal...</p>
        ) : (
          <div className='card-premium p-6 space-y-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Goal title</label>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={readOnly}
                disabled={readOnly}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100'
                placeholder='e.g. Lead my team through the Q3 transformation'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={readOnly}
                disabled={readOnly}
                rows={4}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100'
                placeholder='What does success look like?'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={readOnly}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100'
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex gap-3 pt-2'>
              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className='flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
                >
                  {saving ? 'Saving...' : goal ? 'Update & Continue' : 'Save & Start Baseline'}
                </button>
              )}
              <button
                onClick={() => router.push(readOnly ? '/assessment' : '/dashboard')}
                className='px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50'
              >
                {readOnly ? 'Continue to Baseline' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
    </PageShell>
  );
}
