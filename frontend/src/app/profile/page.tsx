'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import { getCandidateProfile, type CandidateProfile } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  midpoint: 'Midpoint',
  final: 'Final',
};

export default function CandidateProfilePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setFirstName(localStorage.getItem('first_name') || '');

    getCandidateProfile(cid)
      .then(setProfile)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load profile.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const progress = profile?.progress;

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-4xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-blue-900 mb-1'>My Profile</h1>
        <p className='text-gray-500 mb-6'>Your coaching identity, baseline, and session history.</p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500'>Loading profile...</p>
        ) : profile ? (
          <div className='space-y-6'>
            <section className='bg-white rounded-2xl shadow p-6'>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>Overview</h2>
              <dl className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
                <div>
                  <dt className='text-gray-500'>Name</dt>
                  <dd className='font-medium'>
                    {profile.firstName} {profile.lastName}
                  </dd>
                </div>
                <div>
                  <dt className='text-gray-500'>Email</dt>
                  <dd className='font-medium'>{profile.email}</dd>
                </div>
                <div>
                  <dt className='text-gray-500'>Role</dt>
                  <dd className='font-medium'>
                    {profile.roleTitle} ({profile.roleLevel})
                  </dd>
                </div>
                <div>
                  <dt className='text-gray-500'>Coach</dt>
                  <dd className='font-medium'>{profile.coachName}</dd>
                </div>
                <div>
                  <dt className='text-gray-500'>CDL level</dt>
                  <dd className='font-medium'>{profile.cdl}</dd>
                </div>
                {profile.orgName && (
                  <div>
                    <dt className='text-gray-500'>Organization</dt>
                    <dd className='font-medium'>{profile.orgName}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className='bg-white rounded-2xl shadow p-6'>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>Active goal</h2>
              <p className='text-gray-800 font-medium'>
                {profile.activeGoal.title || 'No goal set yet'}
              </p>
              {profile.activeGoal.theme && (
                <p className='text-sm text-gray-500 mt-1'>Theme: {profile.activeGoal.theme}</p>
              )}
              {profile.activeGoal.isOrgAssigned && (
                <span className='inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded'>
                  Assigned by organization
                </span>
              )}
            </section>

            {progress && (
              <section className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Progress snapshot</h2>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                  <Stat label='Baseline' value={String(progress.baselineScore)} />
                  <Stat label='Current' value={String(progress.currentScore)} />
                  <Stat label='Improvement' value={`${progress.scoreDelta >= 0 ? '+' : ''}${progress.scoreDelta}`} />
                  <Stat label='Plan completion' value={`${progress.actionPlanCompletionPercent}%`} />
                </div>
              </section>
            )}

            <section className='bg-white rounded-2xl shadow p-6'>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>Baseline assessment</h2>
              {profile.baselineCompleted && profile.baseline ? (
                <div className='space-y-3 text-sm'>
                  <p>
                    Overall score: <strong>{profile.baseline.score}</strong>
                    {profile.baseline.level ? ` — ${profile.baseline.level}` : ''}
                  </p>
                  {profile.baseline.strengths?.length ? (
                    <div>
                      <p className='text-gray-500 mb-1'>Strengths</p>
                      <ul className='list-disc list-inside text-gray-800'>
                        {profile.baseline.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {profile.baseline.gaps?.length ? (
                    <div>
                      <p className='text-gray-500 mb-1'>Development areas</p>
                      <ul className='list-disc list-inside text-gray-800'>
                        {profile.baseline.gaps.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className='text-xs text-gray-400'>
                    Baseline drives coaching framework selection (GROW, OSKAR, CLEAR, WOOP, STEPPA, and more).
                  </p>
                </div>
              ) : (
                <p className='text-gray-500 text-sm'>
                  Complete your baseline assessment to unlock personalized coaching frameworks.
                </p>
              )}
            </section>

            {profile.assessments.length > 0 && (
              <section className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Assessments</h2>
                <ul className='divide-y divide-gray-100'>
                  {profile.assessments.map((a, idx) => (
                    <li key={`${a.type}-${idx}`} className='py-3 flex justify-between text-sm'>
                      <span>{TYPE_LABELS[a.type] || a.type}</span>
                      <span className='font-medium'>
                        {a.score} — {a.level}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.sessions.length > 0 && (
              <section className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Recent sessions</h2>
                <ul className='divide-y divide-gray-100'>
                  {profile.sessions.map((s) => (
                    <li key={s.id} className='py-3 flex justify-between items-center text-sm'>
                      <div>
                        <span className='font-medium text-gray-800'>{s.framework}</span>
                        {s.completedAt && (
                          <span className='text-gray-400 ml-2'>
                            {new Date(s.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {s.hasRecording && (
                        <span className='text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded'>
                          Recording saved
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.actionPlan.focusAreas?.length > 0 && (
              <section className='bg-white rounded-2xl shadow p-6'>
                <h2 className='text-lg font-semibold text-gray-900 mb-4'>Action plan focus</h2>
                <ul className='list-disc list-inside text-sm text-gray-800'>
                  {profile.actionPlan.focusAreas.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
                <p className='text-sm text-gray-500 mt-3'>
                  {profile.actionPlan.completionPercent}% complete
                </p>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-xl bg-gray-50 p-4 text-center'>
      <div className='text-2xl font-bold text-blue-900'>{value}</div>
      <div className='text-xs text-gray-500 mt-1'>{label}</div>
    </div>
  );
}
