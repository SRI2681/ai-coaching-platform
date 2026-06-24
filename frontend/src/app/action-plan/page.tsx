'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import {
  generateActionPlan,
  getActionPlan,
  updateActionItem,
  type ActionItem,
  type ActionPlan,
  type AssessmentResult,
} from '@/lib/api';
import { downloadActionPlanExcel } from '@/lib/export-action-plan';

const KIND_LABELS: Record<string, string> = {
  milestone: 'Milestone',
  exercise: 'Exercise',
  next_step: 'Next step',
};

function readBaseline(): AssessmentResult | null {
  const raw = localStorage.getItem('last_baseline');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentResult;
  } catch {
    return null;
  }
}

export default function ActionPlanPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [error, setError] = useState('');

  const loadPlan = useCallback(async (cid: string) => {
    try {
      const data = await getActionPlan(cid);
      setPlan(data.plan);
      setItems(data.items);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('No active action plan')) {
        setPlan(null);
        setItems([]);
      } else {
        setError(message || 'Unable to load action plan.');
      }
    }
  }, []);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setCandidateId(cid);
    setFirstName(localStorage.getItem('first_name') || 'there');
    loadPlan(cid).finally(() => setLoading(false));
  }, [router, loadPlan]);

  async function handleGenerate() {
    if (!candidateId) return;
    const baseline = readBaseline();
    if (!baseline) {
      setError('Complete your baseline assessment first.');
      router.push('/assessment');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const goal =
        localStorage.getItem('active_goal_title') ||
        localStorage.getItem('primary_goal') ||
        'Develop executive leadership';
      const goalId = localStorage.getItem('active_goal_id') || undefined;
      const data = await generateActionPlan({
        candidate_id: candidateId,
        goal,
        baseline,
        goal_id: goalId,
      });
      setPlan(data.plan);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate action plan.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(item: ActionItem) {
    setTogglingId(item.id);
    setError('');
    try {
      const updated = await updateActionItem(item.id, !item.is_completed);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update item.');
    } finally {
      setTogglingId('');
    }
  }

  const completed = items.filter((i) => i.is_completed).length;
  const completionPct = items.length ? Math.round((completed / items.length) * 100) : 0;

  const milestones = items.filter((i) => i.kind === 'milestone');
  const exercises = items.filter((i) => i.kind === 'exercise');
  const nextSteps = items.filter((i) => i.kind === 'next_step');
  const otherItems = items.filter(
    (i) => !['milestone', 'exercise', 'next_step'].includes(i.kind)
  );

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-3xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>Your Action Plan</h1>
        <p className='text-gray-500 mb-6'>30-day coaching roadmap with milestones and exercises.</p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading action plan...</p>
        ) : !plan ? (
          <div className='bg-white rounded-2xl shadow p-6 text-center'>
            <p className='text-gray-600 mb-4'>No action plan yet. Generate one from your baseline.</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className='bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-50'
            >
              {generating ? 'Generating...' : 'Generate Action Plan'}
            </button>
          </div>
        ) : (
          <div className='space-y-6'>
            <div className='bg-white rounded-2xl shadow p-6'>
              <div className='flex flex-wrap justify-between gap-4 mb-4'>
                <div>
                  <p className='text-sm text-gray-500'>Completion</p>
                  <p className='text-2xl font-bold text-blue-900'>{completionPct}%</p>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='text-sm text-gray-500'>
                    {completed} of {items.length} items done
                  </div>
                  <button
                    type='button'
                    onClick={() => downloadActionPlanExcel(plan, items, firstName)}
                    className='rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100'
                  >
                    Download Excel
                  </button>
                </div>
              </div>
              <div className='w-full bg-gray-100 rounded-full h-3 mb-4'>
                <div
                  className='bg-blue-600 h-3 rounded-full transition-all'
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              {plan.focus_areas && plan.focus_areas.length > 0 && (
                <div>
                  <p className='text-xs font-semibold uppercase text-gray-500 mb-2'>Focus areas</p>
                  <div className='flex flex-wrap gap-2'>
                    {plan.focus_areas.map((area) => (
                      <span
                        key={area}
                        className='text-sm bg-blue-50 text-blue-800 px-3 py-1 rounded-full'
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ItemSection
              title='Milestones'
              items={milestones}
              togglingId={togglingId}
              onToggle={handleToggle}
            />
            <ItemSection
              title='Exercises'
              items={exercises}
              togglingId={togglingId}
              onToggle={handleToggle}
            />
            <ItemSection
              title='Next steps'
              items={nextSteps}
              togglingId={togglingId}
              onToggle={handleToggle}
            />
            {otherItems.length > 0 && (
              <ItemSection
                title='Other items'
                items={otherItems}
                togglingId={togglingId}
                onToggle={handleToggle}
              />
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold'
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemSection({
  title,
  items,
  togglingId,
  onToggle,
}: {
  title: string;
  items: ActionItem[];
  togglingId: string;
  onToggle: (item: ActionItem) => void;
}) {
  if (!items.length) return null;

  return (
    <div className='bg-white rounded-2xl shadow p-6'>
      <h2 className='text-lg font-bold text-blue-900 mb-4'>{title}</h2>
      <ul className='space-y-3'>
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex gap-3 items-start rounded-lg border p-4 ${
              item.is_completed ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
            }`}
          >
            <input
              type='checkbox'
              checked={item.is_completed}
              disabled={togglingId === item.id}
              onChange={() => onToggle(item)}
              className='mt-1 h-4 w-4 rounded border-gray-300 text-blue-600'
            />
            <div className='flex-1 min-w-0'>
              <div className='flex flex-wrap items-center gap-2 mb-1'>
                <p
                  className={`font-medium text-gray-900 ${
                    item.is_completed ? 'line-through text-gray-500' : ''
                  }`}
                >
                  {item.title}
                </p>
                <span className='text-xs uppercase tracking-wide text-gray-400'>
                  {KIND_LABELS[item.kind] || item.kind}
                </span>
              </div>
              {item.detail && <p className='text-sm text-gray-600'>{item.detail}</p>}
              <div className='flex flex-wrap gap-3 mt-2 text-xs text-gray-500'>
                {item.due_date && <span>Due {item.due_date}</span>}
                {item.completed_at && (
                  <span>Completed {new Date(item.completed_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
