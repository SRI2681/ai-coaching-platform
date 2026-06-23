'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' },
  { href: '/goal-setup', label: 'Goal Setup' },
  { href: '/assessment', label: 'Baseline' },
  { href: '/skill-check', label: 'Skill Check' },
  { href: '/action-plan', label: 'Action Plan' },
  { href: '/progress', label: 'Progress' },
  { href: '/report', label: 'Final Report' },
  { href: '/summary', label: 'Session Summary' },
];

export default function AppNav({ firstName }: { firstName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className='bg-blue-900 text-white px-8 py-4 flex justify-between items-center'>
      <div className='flex items-center gap-6'>
        <span className='text-xl font-bold shrink-0'>AI Executive Coach</span>
        <div className='flex gap-4 text-sm'>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                pathname === href
                  ? 'text-white font-semibold border-b-2 border-white pb-0.5'
                  : 'text-blue-300 hover:text-white'
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className='flex items-center gap-4'>
        {firstName && <span className='text-sm'>Welcome, {firstName}</span>}
        <button
          onClick={() => {
            localStorage.clear();
            router.push('/');
          }}
          className='text-blue-300 hover:text-white text-sm'
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
