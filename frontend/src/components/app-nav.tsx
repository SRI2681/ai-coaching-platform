'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' },
  { href: '/goal-setup', label: 'Goals' },
  { href: '/assessment', label: 'Baseline' },
  { href: '/action-plan', label: 'Action Plan' },
  { href: '/skill-check', label: 'Skill Check' },
  { href: '/progress', label: 'Progress' },
  { href: '/summary', label: 'Sessions' },
];

function LogoMark() {
  return (
    <svg width='32' height='32' viewBox='0 0 32 32' fill='none' aria-hidden>
      <rect width='32' height='32' rx='8' fill='url(#logo-grad)' />
      <path
        d='M10 22V10l6 7 6-7v12'
        stroke='white'
        strokeWidth='2.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <defs>
        <linearGradient id='logo-grad' x1='0' y1='0' x2='32' y2='32'>
          <stop stopColor='#6366f1' />
          <stop offset='1' stopColor='#0d9488' />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AppNav({ firstName }: { firstName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className='nav-premium px-4 md:px-8 py-3.5 print:hidden'>
      <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-5 min-w-0'>
          <Link href='/dashboard' className='flex items-center gap-2.5 shrink-0'>
            <LogoMark />
            <span className='font-display text-lg font-bold text-white tracking-tight hidden sm:block'>
              AI Executive Coach
            </span>
          </Link>
          <div className='hidden lg:flex items-center gap-0.5 flex-wrap'>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={pathname === href ? 'nav-link nav-link-active' : 'nav-link'}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className='flex items-center gap-4'>
          {firstName && (
            <span className='text-sm text-white/80 hidden sm:block'>
              <span className='text-white/50'>Welcome,</span>{' '}
              <span className='font-medium text-white'>{firstName}</span>
            </span>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className='text-sm font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors'
          >
            Sign out
          </button>
        </div>
      </div>
      <div className='lg:hidden max-w-7xl mx-auto mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-hide'>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`shrink-0 ${pathname === href ? 'nav-link nav-link-active' : 'nav-link'}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
