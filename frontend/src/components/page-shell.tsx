'use client';

import AppNav from '@/components/app-nav';

export default function PageShell({
  firstName,
  children,
  wide,
}: {
  firstName?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className='app-page print:bg-white'>
      <AppNav firstName={firstName} />
      <main className={`page-container ${wide ? 'max-w-6xl' : ''}`}>{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <header className='mb-8'>
      {badge && <span className='badge badge-indigo mb-3'>{badge}</span>}
      <h1 className='page-title'>{title}</h1>
      {subtitle && <p className='page-subtitle'>{subtitle}</p>}
    </header>
  );
}
