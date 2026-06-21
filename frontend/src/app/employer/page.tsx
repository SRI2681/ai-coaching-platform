'use client';

import { useEffect, useState } from 'react';
import { getTeamAnalytics, type TeamAnalytics } from '@/lib/api';

export default function EmployerPage() {
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cid = localStorage.getItem('company_id') || 'test';

    getTeamAnalytics(cid)
      .then(data => {
        setAnalytics(data);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unable to load team analytics.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const cdlLabels = ['', 'Foundation', 'Developing', 'Practitioner', 'Advanced', 'Executive'];
  const cdlColors = ['', 'bg-gray-400', 'bg-blue-400', 'bg-blue-600', 'bg-purple-600', 'bg-yellow-500'];

  return (
    <div className='min-h-screen bg-gray-50'>
      <nav className='bg-blue-900 text-white px-8 py-4'>
        <h1 className='text-xl font-bold'>Team Coaching Analytics</h1>
        <p className='text-blue-300 text-sm mt-1'>
          Aggregate data only — individual session content is private.
        </p>
      </nav>

      <div className='max-w-4xl mx-auto p-8'>
        {loading ? (
          <div className='text-center text-gray-500 py-12'>Loading analytics...</div>
        ) : error ? (
          <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        ) : (
          <>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
              <div className='bg-white rounded-2xl shadow p-6 text-center'>
                <p className='text-4xl font-bold text-blue-900'>{analytics?.team_size ?? 0}</p>
                <p className='text-gray-500 text-sm mt-1'>Team Members</p>
              </div>
              <div className='bg-white rounded-2xl shadow p-6 text-center'>
                <p className='text-4xl font-bold text-blue-900'>{analytics?.avg_cdl ?? 0}</p>
                <p className='text-gray-500 text-sm mt-1'>Team Average CDL</p>
              </div>
              <div className='bg-white rounded-2xl shadow p-6 text-center'>
                <p className='text-4xl font-bold text-blue-900'>{analytics?.total_sessions ?? 0}</p>
                <p className='text-gray-500 text-sm mt-1'>Completed Sessions</p>
              </div>
            </div>

            <div className='bg-white rounded-2xl shadow p-6'>
              <h2 className='text-lg font-bold text-blue-900 mb-4'>CDL Distribution</h2>
              <div className='space-y-3'>
                {Object.entries(analytics?.cdl_distribution ?? {}).map(([band, count]) => {
                  const bandNum = parseInt(band, 10);
                  const teamSize = analytics?.team_size ?? 0;
                  const width = teamSize > 0 ? `${(count / teamSize) * 100}%` : '0%';

                  return (
                    <div key={band} className='flex items-center gap-3'>
                      <span className='w-28 text-sm text-gray-600'>{cdlLabels[bandNum]}</span>
                      <div className='flex-1 bg-gray-100 rounded-full h-4'>
                        <div
                          className={`${cdlColors[bandNum]} h-4 rounded-full transition-all`}
                          style={{ width }}
                        />
                      </div>
                      <span className='w-6 text-sm font-bold text-gray-800'>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
