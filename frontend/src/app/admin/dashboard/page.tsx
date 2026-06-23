'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPlatformOverview, type PlatformOverview } from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('');
  const [adminId, setAdminId] = useState('');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('platform_admin_id');
    if (!id) {
      router.push('/?portal=admin');
      return;
    }
    setAdminId(id);
    setAdminName(localStorage.getItem('platform_admin_name') || 'Admin');
    getPlatformOverview(id)
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load overview.'))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className='min-h-screen bg-violet-50'>
      <nav className='bg-violet-900 text-white px-8 py-4 flex justify-between items-center'>
        <span className='text-xl font-bold'>Platform Admin</span>
        <div className='flex items-center gap-4 text-sm'>
          <span>Welcome, {adminName}</span>
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/?portal=admin');
            }}
            className='text-violet-200 hover:text-white'
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className='max-w-4xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-violet-950 mb-1'>Platform overview</h1>
        <p className='text-sm text-violet-700 mb-6'>Cross-tenant metrics for platform operations.</p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
            {error.includes('Platform admin') && (
              <p className='mt-2'>
                Run migration <code>v12_platform_admins.sql</code> and seed a super-admin account.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <p className='text-violet-700'>Loading...</p>
        ) : overview ? (
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
            <StatCard label='Organizations' value={overview.organizationCount} />
            <StatCard label='Candidates' value={overview.candidateCount} />
            <StatCard label='Coaching sessions' value={overview.sessionCount} />
            <StatCard label='Pending invites' value={overview.pendingInvites} />
          </div>
        ) : null}

        <div className='mt-8 flex gap-4 text-sm'>
          <Link href='/?portal=organization' className='text-violet-800 underline'>
            Organization login
          </Link>
          <Link href='/' className='text-violet-800 underline'>
            Candidate login
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className='bg-white rounded-2xl shadow p-5'>
      <div className='text-3xl font-bold text-violet-900'>{value}</div>
      <div className='text-sm text-violet-600 mt-1'>{label}</div>
    </div>
  );
}
