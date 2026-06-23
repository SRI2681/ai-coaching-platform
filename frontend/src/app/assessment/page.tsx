'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import {
  answerAssessment,
  generateActionPlan,
  getAssessmentStatus,
  startAssessment,
  type AssessmentQuestion,
  type BaselineRecord,
} from '@/lib/api';

function BaselineResults({
  result,
  locked,
  onGeneratePlan,
  generatingPlan,
}: {
  result: BaselineRecord;
  locked?: boolean;
  onGeneratePlan?: () => void;
  generatingPlan?: boolean;
}) {
  const profile = result.methodology_profile;

  return (
    <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
      {locked && (
        <div className='rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800'>
          Your baseline is saved permanently. Progress is measured against this profile using
          adaptive skill checks.
        </div>
      )}
      <h2 className='text-lg font-bold text-blue-900'>
        {locked ? 'Baseline on file' : 'Baseline complete'}
      </h2>
      <p className='text-3xl font-bold text-blue-700'>
        {result.level} · {result.score}/100
      </p>

      {profile?.disc_style && (
        <p className='text-sm text-gray-600'>
          DISC style: <span className='font-semibold'>{profile.disc_style}</span>
        </p>
      )}

      {profile?.executive_summary && (
        <p className='text-sm text-gray-700 leading-relaxed'>{profile.executive_summary}</p>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='rounded-lg bg-green-50 p-4'>
          <p className='text-xs font-semibold uppercase text-green-700 mb-2'>Strengths</p>
          <ul className='text-sm text-gray-800 list-disc pl-4'>
            {result.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className='rounded-lg bg-amber-50 p-4'>
          <p className='text-xs font-semibold uppercase text-amber-700 mb-2'>Gaps</p>
          <ul className='text-sm text-gray-800 list-disc pl-4'>
            {result.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>

      {profile?.clifton_themes && profile.clifton_themes.length > 0 && (
        <div>
          <p className='text-xs font-semibold uppercase text-purple-700 mb-2'>
            Clifton-style themes
          </p>
          <div className='flex flex-wrap gap-2'>
            {profile.clifton_themes.map((theme) => (
              <span
                key={theme}
                className='text-xs bg-purple-50 text-purple-800 px-2 py-1 rounded-full'
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {onGeneratePlan && (
        <button
          onClick={onGeneratePlan}
          disabled={generatingPlan}
          className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
        >
          {generatingPlan ? 'Building your action plan...' : 'Generate 30-Day Action Plan'}
        </button>
      )}
    </div>
  );
}

export default function BaselineAssessmentPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<AssessmentQuestion | null>(null);
  const [tier, setTier] = useState(1);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BaselineRecord | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [baselineLocked, setBaselineLocked] = useState(false);
  const questionTotal = 10;

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    const goal =
      localStorage.getItem('active_goal_title') ||
      localStorage.getItem('primary_goal') ||
      'Develop executive leadership';

    setCandidateId(cid);
    setFirstName(localStorage.getItem('first_name') || 'there');
    setGoalTitle(goal);

    getAssessmentStatus(cid)
      .then(async (status) => {
        if (status.baselineCompleted && status.baseline) {
          setResult(status.baseline);
          setBaselineLocked(true);
          return;
        }

        const startRes = await startAssessment(cid, goal, 'baseline');
        if (startRes.already_completed && startRes.result) {
          setResult(startRes.result);
          setBaselineLocked(true);
          return;
        }

        setAssessmentId(startRes.assessment_id);
        setCurrentQuestion(startRes.question);
        setTier(startRes.tier ?? startRes.question.tier ?? 1);
        if (startRes.resumed && startRes.questions_answered) {
          setAnswerIndex(startRes.questions_answered);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load assessment.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmitAnswer() {
    if (!assessmentId || !currentQuestion || !answerText.trim() || baselineLocked) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await answerAssessment({
        assessment_id: assessmentId,
        question: currentQuestion.question,
        answer: answerText.trim(),
        tier,
        competency_lens: currentQuestion.competency_lens || currentQuestion.competency_focus,
      });

      if (res.done && res.result) {
        setResult(res.result);
        setBaselineLocked(true);
        setCurrentQuestion(null);
        return;
      }

      setAnswerIndex((n) => n + 1);
      setAnswerText('');
      if (res.question) {
        setCurrentQuestion(res.question);
        setTier(res.tier ?? tier);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit answer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGeneratePlan() {
    if (!candidateId || !result) return;
    setGeneratingPlan(true);
    setError('');
    try {
      const goalId = localStorage.getItem('active_goal_id') || undefined;
      await generateActionPlan({
        candidate_id: candidateId,
        goal: goalTitle,
        baseline: result,
        goal_id: goalId,
      });
      router.push('/action-plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate action plan.');
    } finally {
      setGeneratingPlan(false);
    }
  }

  const progress = result ? questionTotal : answerIndex + 1;
  const lens =
    currentQuestion?.competency_lens || currentQuestion?.competency_focus;

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-2xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>Baseline Skill Assessment</h1>
        <p className='text-gray-500 mb-1'>Goal: {goalTitle}</p>
        <p className='text-sm text-gray-400 mb-6'>
          One-time diagnostic combining CliftonStrengths, DISC, and executive competencies.
          {!baselineLocked && (
            <> Question {Math.min(progress, questionTotal)} of {questionTotal} · Tier {tier}</>
          )}
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading assessment...</p>
        ) : result ? (
          <BaselineResults
            result={result}
            locked={baselineLocked}
            onGeneratePlan={baselineLocked ? handleGeneratePlan : undefined}
            generatingPlan={generatingPlan}
          />
        ) : (
          <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
            {lens && (
              <span className='inline-block text-xs font-semibold uppercase tracking-wide text-purple-700 bg-purple-50 px-2 py-1 rounded'>
                Lens: {lens}
              </span>
            )}
            <p className='text-lg text-gray-800 leading-relaxed'>{currentQuestion?.question}</p>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={5}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900'
              placeholder='Speak your answer in 2–4 sentences...'
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !answerText.trim()}
              className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
            >
              {submitting ? 'Scoring...' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
