'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/app-nav';
import type { SessionDebrief } from '@/lib/api';

const CDL_LABELS = ['', 'Foundation', 'Developing', 'Practitioner', 'Advanced', 'Executive'];

function movementLabel(movement: string): { text: string; color: string } {
  if (movement === 'advanced') return { text: 'Advanced', color: 'text-green-700 bg-green-100' };
  if (movement === 'regressed') return { text: 'Needs focus', color: 'text-amber-700 bg-amber-100' };
  return { text: 'Held steady', color: 'text-blue-700 bg-blue-100' };
}

function readDebrief(): SessionDebrief | null {
  const raw = localStorage.getItem('debrief') || localStorage.getItem('last_debrief');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionDebrief;
  } catch {
    return null;
  }
}

export default function SummaryPage() {
  const router = useRouter();
  const [debrief, setDebrief] = useState<SessionDebrief | null>(null);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    const cid = localStorage.getItem('candidate_id');
    if (!cid) {
      router.push('/');
      return;
    }
    setFirstName(localStorage.getItem('first_name') || 'there');
    const data = readDebrief();
    if (!data) {
      router.push('/dashboard');
      return;
    }
    setDebrief(data);
    localStorage.setItem('last_debrief', JSON.stringify(data));
    localStorage.removeItem('debrief');
  }, [router]);

  if (!debrief) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <p className='text-gray-500'>Loading your session summary...</p>
      </div>
    );
  }

  const movement = movementLabel(debrief.cdl_movement);
  const cdlBand = Math.min(5, Math.max(1, Math.floor(debrief.cdl_end)));

  return (
    <div className='min-h-screen bg-gray-50'>
      <AppNav firstName={firstName} />

      <div className='max-w-3xl mx-auto p-8 space-y-6'>
        <div>
          <h1 className='text-2xl font-bold text-blue-900'>Session Summary</h1>
          <p className='text-gray-500 mt-1'>Great work, {firstName}. Here is your debrief.</p>
        </div>
        <div className='bg-white rounded-2xl shadow p-6'>
          <div className='flex flex-wrap items-center justify-between gap-4 mb-4'>
            <div>
              <p className='text-sm text-gray-500'>Coaching Level</p>
              <p className='text-2xl font-bold text-blue-900'>
                CDL {debrief.cdl_start.toFixed(1)} → {debrief.cdl_end.toFixed(1)}
              </p>
              <p className='text-sm text-gray-600'>{CDL_LABELS[cdlBand]}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${movement.color}`}>
              {movement.text}
            </span>
          </div>
          {debrief.framework && (
            <p className='text-sm text-gray-500'>
              Framework used: <span className='font-medium text-gray-800'>{debrief.framework}</span>
            </p>
          )}
          <p className='mt-4 text-gray-700 leading-relaxed'>{debrief.summary_text}</p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='bg-white rounded-2xl shadow p-5 border-l-4 border-green-500'>
            <p className='text-xs font-semibold uppercase text-green-700 mb-2'>Key win</p>
            <p className='text-gray-800 text-sm'>{debrief.key_win}</p>
          </div>
          <div className='bg-white rounded-2xl shadow p-5 border-l-4 border-amber-500'>
            <p className='text-xs font-semibold uppercase text-amber-700 mb-2'>Area to develop</p>
            <p className='text-gray-800 text-sm'>{debrief.key_gap}</p>
          </div>
        </div>

        {debrief.key_insight && (
          <div className='bg-white rounded-2xl shadow p-5'>
            <p className='text-xs font-semibold uppercase text-purple-700 mb-2'>Key insight</p>
            <p className='text-gray-800 text-sm'>{debrief.key_insight}</p>
          </div>
        )}

        <div className='bg-blue-900 text-white rounded-2xl shadow p-6'>
          <p className='text-xs font-semibold uppercase text-blue-200 mb-2'>Your action before next session</p>
          <p className='text-lg leading-relaxed'>{debrief.action_item}</p>
        </div>

        {debrief.growth_moment && (
          <div className='bg-white rounded-2xl shadow p-5 border border-gray-200'>
            <p className='text-xs font-semibold uppercase text-gray-500 mb-2'>Growth moment</p>
            <p className='text-gray-700 italic text-sm'>&ldquo;{debrief.growth_moment}&rdquo;</p>
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className='w-full bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3 font-semibold'
        >
          Back to Leader Dashboard
        </button>
      </div>
    </div>
  );
}
