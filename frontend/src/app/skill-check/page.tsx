'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import {
  answerAssessment,
  getAssessmentStatus,
  startAssessment,
  type AssessmentQuestion,
  type AssessmentResult,
} from '@/lib/api';

const PROGRESS_QUESTIONS = 8;

export default function SkillCheckPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [testType, setTestType] = useState<'midpoint' | 'final'>('midpoint');
  const [currentQuestion, setCurrentQuestion] = useState<AssessmentQuestion | null>(null);
  const [tier, setTier] = useState(1);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [canTest, setCanTest] = useState(false);

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setCandidateId(cid);
    setFirstName(localStorage.getItem('first_name') || 'there');
    setGoalTitle(
      localStorage.getItem('active_goal_title') ||
        localStorage.getItem('primary_goal') ||
        'Develop executive leadership'
    );

    getAssessmentStatus(cid)
      .then((status) => {
        setCanTest(status.canTakeProgressTest);
        if (!status.canTakeProgressTest) {
          setError('Complete your one-time baseline assessment first.');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load status.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleStart(type: 'midpoint' | 'final') {
    if (!candidateId) return;
    setStarting(true);
    setError('');
    setResult(null);
    setTestType(type);

    try {
      const res = await startAssessment(candidateId, goalTitle, type);
      setAssessmentId(res.assessment_id);
      setCurrentQuestion(res.question);
      setTier(res.tier ?? res.question.tier ?? 1);
      setAnswerIndex(res.questions_answered ?? 0);
      setAnswerText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start skill check.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!assessmentId || !currentQuestion || !answerText.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await answerAssessment({
        assessment_id: assessmentId,
        question: currentQuestion.question,
        answer: answerText.trim(),
        tier,
        skill_target: currentQuestion.skill_target,
        competency_lens: currentQuestion.competency_focus,
      });

      if (res.done && res.result) {
        setResult(res.result);
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

  const inProgress = Boolean(assessmentId && currentQuestion && !result);
  const progress = result ? PROGRESS_QUESTIONS : answerIndex + 1;

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-2xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>Goal Skill Check</h1>
        <p className='text-gray-500 mb-1'>Goal: {goalTitle}</p>
        <p className='text-sm text-gray-400 mb-6'>
          Adaptive check measuring skill growth toward your goal since baseline.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading...</p>
        ) : !canTest ? (
          <div className='bg-white rounded-2xl shadow p-6 text-center'>
            <button
              onClick={() => router.push('/assessment')}
              className='bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-6 py-3 font-semibold'
            >
              Go to Baseline Assessment
            </button>
          </div>
        ) : result ? (
          <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <h2 className='text-lg font-bold text-blue-900 capitalize'>{testType} complete</h2>
            <p className='text-3xl font-bold text-blue-700'>
              {result.level} · {result.score}/100
            </p>
            {result.goal_progress_pct != null && (
              <p className='text-lg text-green-700 font-semibold'>
                ~{result.goal_progress_pct}% of goal skill gap closed since baseline
              </p>
            )}
            <button
              onClick={() => router.push('/progress')}
              className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold'
            >
              View Progress Dashboard
            </button>
          </div>
        ) : inProgress && currentQuestion ? (
          <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <p className='text-sm text-gray-500'>
              Question {Math.min(progress, PROGRESS_QUESTIONS)} of {PROGRESS_QUESTIONS} · Tier{' '}
              {tier} · {testType}
            </p>
            {currentQuestion.skill_target && (
              <span className='inline-block text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-50 px-2 py-1 rounded'>
                Testing: {currentQuestion.skill_target}
              </span>
            )}
            <p className='text-lg text-gray-800 leading-relaxed'>{currentQuestion.question}</p>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={5}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900'
              placeholder='Demonstrate how you have built this skill...'
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !answerText.trim()}
              className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
            >
              {submitting ? 'Scoring...' : 'Submit Answer'}
            </button>
          </div>
        ) : (
          <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <p className='text-gray-600 text-sm'>
              Choose a progress test. Questions adapt to your answers — harder when you
              demonstrate mastery, targeted when gaps remain.
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <button
                onClick={() => handleStart('midpoint')}
                disabled={starting}
                className='rounded-lg border border-gray-200 px-4 py-4 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50'
              >
                <p className='font-semibold text-gray-800'>Midpoint check</p>
                <p className='text-xs text-gray-500 mt-1'>Mid-program skill growth</p>
              </button>
              <button
                onClick={() => handleStart('final')}
                disabled={starting}
                className='rounded-lg border border-gray-200 px-4 py-4 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50'
              >
                <p className='font-semibold text-gray-800'>Final check</p>
                <p className='text-xs text-gray-500 mt-1'>End-of-program assessment</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
