'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const ORG_LINKS = [
  { href: '/org/roster', label: 'Roster' },
  { href: '/org/progress', label: 'Progress' },
  { href: '/org/goals', label: 'Assign Goals' },
  { href: '/org/pipeline', label: 'Pipeline' },
  { href: '/org/onboarding', label: 'Add Employees' },
];

export default function OrgNav({ orgName }: { orgName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className='bg-slate-900 text-white px-8 py-4 flex justify-between items-center'>
      <div className='flex items-center gap-6'>
        <span className='text-xl font-bold shrink-0'>Organization Portal</span>
        {orgName && <span className='text-sm text-slate-400'>{orgName}</span>}
        <div className='flex gap-4 text-sm'>
          {ORG_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                pathname === href
                  ? 'text-white font-semibold border-b-2 border-white pb-0.5'
                  : 'text-slate-400 hover:text-white'
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.removeItem('org_admin_id');
          localStorage.removeItem('org_id');
          localStorage.removeItem('org_name');
          localStorage.removeItem('org_admin_name');
          router.push('/org/login');
        }}
        className='text-slate-400 hover:text-white text-sm'
      >
        Sign out
      </button>
    </nav>
  );
}
