'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginCandidate, registerCandidate } from '@/lib/api';

type AuthMode = 'login' | 'signup';

const inputClassName =
  'w-full border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function persistSession(result: {
    candidate_id: string;
    first_name?: string;
    current_cdl?: number;
    coach_name?: string;
  }) {
    localStorage.setItem('candidate_id', result.candidate_id);
    localStorage.setItem('first_name', result.first_name ?? firstName);
    localStorage.setItem('current_cdl', String(result.current_cdl ?? 1));
    localStorage.setItem('coach_name', result.coach_name ?? 'Alex');
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginCandidate(email, password);
      persistSession(result);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await registerCandidate({
        email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_title: 'Leader',
        role_level: 'manager',
        coach_name: 'Alex',
        primary_goal: primaryGoal.trim() || 'Develop leadership skills',
      });

      const result = await loginCandidate(email, password);
      persistSession(result);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <div className='min-h-screen bg-white flex items-center justify-center p-4'>
      <div className='bg-white border border-gray-200 rounded-2xl shadow-lg p-8 w-full max-w-md'>
        <h1 className='text-3xl font-bold text-blue-900 text-center mb-2'>AI Executive Coach</h1>
        <p className='text-gray-500 text-center mb-6'>
          {mode === 'login' ? 'Sign in to your coaching platform' : 'Create your coaching account'}
        </p>

        <div className='mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1'>
          <button
            type='button'
            onClick={() => switchMode('login')}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type='button'
            onClick={() => switchMode('signup')}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === 'signup' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Email</label>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClassName}
                placeholder='you@company.com'
                autoComplete='email'
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Password</label>
              <input
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClassName}
                autoComplete='current-password'
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
        ) : (
          <form onSubmit={handleSignup} className='space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>First name</label>
                <input
                  type='text'
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className={inputClassName}
                  autoComplete='given-name'
                  required
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Last name</label>
                <input
                  type='text'
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className={inputClassName}
                  autoComplete='family-name'
                  required
                />
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Email</label>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClassName}
                placeholder='you@company.com'
                autoComplete='email'
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Password</label>
              <input
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClassName}
                autoComplete='new-password'
                minLength={6}
                required
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Primary coaching goal <span className='text-gray-400'>(optional)</span>
              </label>
              <input
                type='text'
                value={primaryGoal}
                onChange={e => setPrimaryGoal(e.target.value)}
                className={inputClassName}
                placeholder='Develop leadership skills'
              />
            </div>
            {error && <p className='text-red-600 text-sm'>{error}</p>}
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-blue-700 text-white rounded-lg py-3 font-semibold hover:bg-blue-800 disabled:opacity-50'
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
