'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginCandidate } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginCandidate(email, password);
      localStorage.setItem('candidate_id', result.candidate_id);
      localStorage.setItem('first_name', result.first_name ?? '');
      localStorage.setItem('current_cdl', String(result.current_cdl ?? 1));
      localStorage.setItem('coach_name', result.coach_name ?? 'Alex');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4'>
      <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md'>
        <h1 className='text-3xl font-bold text-blue-900 text-center mb-2'>AI Executive Coach</h1>
        <p className='text-gray-500 text-center mb-8'>Sign in to your coaching platform</p>

        <form onSubmit={handleLogin} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Email</label>
            <input
              type='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='you@company.com'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Password</label>
            <input
              type='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
            />
          </div>
          {error && <p className='text-red-600 text-sm'>{error}</p>}
          <button
            type='submit'
            disabled={loading}
            className='w-full bg-blue-700 text-white rounded-lg py-3 font-semibold hover:bg-blue-800 disabled:opacity-50'
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className='text-center text-sm text-gray-500 mt-6'>
          New to the platform? Contact your program administrator.
        </p>
      </div>
    </div>
  );
}
