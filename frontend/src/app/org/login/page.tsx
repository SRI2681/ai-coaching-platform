'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginOrgAdmin } from '@/lib/api';

export default function OrgLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const adminId = localStorage.getItem('org_admin_id');
    const orgId = localStorage.getItem('org_id');
    if (adminId && orgId) {
      router.push('/org/roster');
    } else {
      router.push('/?portal=organization');
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await loginOrgAdmin(email, password, organizationId);
      if (result.role !== 'org_admin') {
        throw new Error('Org admin access required.');
      }
      localStorage.setItem('org_admin_id', result.admin_id);
      localStorage.setItem('org_id', result.org_id);
      localStorage.setItem('org_name', result.org_name);
      localStorage.setItem('org_admin_name', result.first_name);
      router.push('/org/roster');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-slate-100 flex items-center justify-center p-6'>
      <div className='bg-white rounded-2xl shadow-lg p-8 w-full max-w-md'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>Organization Login</h1>
        <p className='text-sm text-slate-500 mb-6'>
          Admin access only. Coaching transcripts are never visible here.
        </p>

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-slate-700 mb-1'>Organization ID</label>
            <input
              type='text'
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              required
              className='w-full rounded-lg border border-slate-300 px-3 py-2'
              placeholder='UUID from your org setup'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-slate-700 mb-1'>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full rounded-lg border border-slate-300 px-3 py-2'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-slate-700 mb-1'>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full rounded-lg border border-slate-300 px-3 py-2'
            />
          </div>
          <button
            type='submit'
            disabled={loading}
            className='w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 font-semibold disabled:opacity-50'
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className='text-center text-sm text-slate-500 mt-4'>
          <a href='/' className='text-slate-900 underline font-medium'>
            Back to unified login
          </a>
          {' · '}
          <a href='/org/onboarding' className='text-slate-900 underline font-medium'>
            Start onboarding
          </a>
        </p>
      </div>
    </div>
  );
}
