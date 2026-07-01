'use client';

import Link from 'next/link';

export default function LandingHeader({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <header className='landing-header'>
      <div className='landing-header-inner'>
        <Link href='/' className='landing-logo'>
          <span className='landing-logo-mark' aria-hidden>
            <svg width='28' height='28' viewBox='0 0 32 32' fill='none'>
              <path
                d='M8 24V8l8 9 8-9v16'
                stroke='white'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </span>
          <span className='font-display font-bold text-[var(--brand-navy)]'>AI Executive Coach</span>
        </Link>

        <nav className='hidden md:flex items-center gap-8 text-sm font-medium text-slate-600'>
          <a href='#scenarios' className='hover:text-indigo-600 transition-colors'>
            Practice scenarios
          </a>
          <a href='#how-it-works' className='hover:text-indigo-600 transition-colors'>
            How it works
          </a>
          <Link href='/org/onboarding' className='hover:text-indigo-600 transition-colors'>
            For organizations
          </Link>
        </nav>

        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={onGetStarted}
            className='hidden sm:inline text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors'
          >
            Sign in
          </button>
          <button type='button' onClick={onGetStarted} className='btn-landing-cta'>
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}
