'use client';

import Link from 'next/link';

export default function LandingHeader({
  onSignIn,
  onGetStarted,
  onOrgSignIn,
}: {
  onSignIn: () => void;
  onGetStarted: () => void;
  onOrgSignIn: () => void;
}) {
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
          <a href='#scenarios' className='landing-nav-link'>
            Scenarios
          </a>
          <a href='#how-it-works' className='landing-nav-link'>
            Your journey
          </a>
          <button type='button' onClick={onOrgSignIn} className='landing-nav-link'>
            Organization login
          </button>
        </nav>

        <div className='flex items-center gap-3'>
          <button type='button' onClick={onSignIn} className='btn-landing-ghost'>
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
