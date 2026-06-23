'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrgNav from '@/components/org-nav';
import {
  addOrgInvites,
  getOrgInvites,
  registerOrganization,
  type OrgRegisterResponse,
} from '@/lib/api';

type Step = 'org' | 'admin' | 'employees' | 'done';

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

function inviteLink(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?invite=${token}`;
}

export default function OrgOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('org');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [adminFirst, setAdminFirst] = useState('');
  const [adminLast, setAdminLast] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [employeeEmails, setEmployeeEmails] = useState('');

  const [result, setResult] = useState<OrgRegisterResponse | null>(null);
  const [existingOrgId, setExistingOrgId] = useState('');
  const [existingAdminId, setExistingAdminId] = useState('');
  const [existingOrgName, setExistingOrgName] = useState('');

  useEffect(() => {
    const orgId = localStorage.getItem('org_id');
    const adminId = localStorage.getItem('org_admin_id');
    if (orgId && adminId) {
      setExistingOrgId(orgId);
      setExistingAdminId(adminId);
      setExistingOrgName(localStorage.getItem('org_name') || '');
      setStep('employees');
      getOrgInvites(orgId, adminId)
        .then((data) => {
          if (data.invites.length) {
            setResult({
              org_id: orgId,
              org_name: localStorage.getItem('org_name') || '',
              admin_id: adminId,
              invites: data.invites.map((i) => ({
                email: i.email,
                invite_token: i.invite_token,
                status: i.status,
              })),
            });
          }
        })
        .catch(() => undefined);
    }
  }, []);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const emails = parseEmails(employeeEmails);
      const res = await registerOrganization({
        org_name: orgName.trim(),
        contact_email: contactEmail.trim(),
        admin_first_name: adminFirst.trim(),
        admin_last_name: adminLast.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        invite_emails: emails,
      });
      localStorage.setItem('org_admin_id', res.admin_id);
      localStorage.setItem('org_id', res.org_id);
      localStorage.setItem('org_name', res.org_name);
      localStorage.setItem('org_admin_name', adminFirst.trim());
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEmployees(e: FormEvent) {
    e.preventDefault();
    const orgId = existingOrgId || result?.org_id;
    const adminId = existingAdminId || result?.admin_id;
    if (!orgId || !adminId) return;

    setLoading(true);
    setError('');
    try {
      const emails = parseEmails(employeeEmails);
      if (!emails.length) {
        throw new Error('Add at least one employee email.');
      }
      const res = await addOrgInvites(orgId, adminId, emails);
      setResult((prev) => ({
        org_id: orgId,
        org_name: prev?.org_name || existingOrgName,
        admin_id: adminId,
        invites: [...(prev?.invites || []), ...res.invites],
      }));
      setEmployeeEmails('');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invites.');
    } finally {
      setLoading(false);
    }
  }

  const isLoggedIn = Boolean(existingOrgId && existingAdminId);
  const displayOrgName = result?.org_name || existingOrgName;

  return (
    <div className='min-h-screen bg-slate-50'>
      {isLoggedIn ? <OrgNav orgName={displayOrgName} /> : null}

      <div className='max-w-2xl mx-auto p-8'>
        <h1 className='text-2xl font-bold text-slate-900 mb-1'>
          {isLoggedIn ? 'Add employees' : 'Organization signup'}
        </h1>
        <p className='text-sm text-slate-500 mb-6'>
          Invite leaders by email. They join with a personal link — no database setup required.
        </p>

        {!isLoggedIn && (
          <div className='flex gap-2 mb-8'>
            {(['org', 'admin', 'employees'] as const).map((s, idx) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded ${
                  step === s || (step === 'done' && idx < 3)
                    ? 'bg-slate-900'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {error && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {step === 'org' && !isLoggedIn && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep('admin');
            }}
            className='bg-white rounded-2xl shadow p-6 space-y-4'
          >
            <h2 className='font-semibold text-slate-800'>Organization details</h2>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Company name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Contact email</label>
              <input
                type='email'
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              />
            </div>
            <button
              type='submit'
              className='w-full bg-slate-900 text-white rounded-lg py-3 font-semibold hover:bg-slate-800'
            >
              Continue
            </button>
            <p className='text-center text-sm text-slate-500'>
              Already registered?{' '}
              <Link href='/org/login' className='text-slate-900 underline'>
                Sign in
              </Link>
            </p>
          </form>
        )}

        {step === 'admin' && !isLoggedIn && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep('employees');
            }}
            className='bg-white rounded-2xl shadow p-6 space-y-4'
          >
            <h2 className='font-semibold text-slate-800'>Admin account</h2>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-sm font-medium text-slate-700 mb-1'>First name</label>
                <input
                  value={adminFirst}
                  onChange={(e) => setAdminFirst(e.target.value)}
                  required
                  className='w-full rounded-lg border border-slate-300 px-3 py-2'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-slate-700 mb-1'>Last name</label>
                <input
                  value={adminLast}
                  onChange={(e) => setAdminLast(e.target.value)}
                  required
                  className='w-full rounded-lg border border-slate-300 px-3 py-2'
                />
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Work email</label>
              <input
                type='email'
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-slate-700 mb-1'>Password</label>
              <input
                type='password'
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                minLength={6}
                required
                className='w-full rounded-lg border border-slate-300 px-3 py-2'
              />
            </div>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setStep('org')}
                className='flex-1 border border-slate-300 rounded-lg py-3 font-semibold text-slate-700'
              >
                Back
              </button>
              <button
                type='submit'
                className='flex-1 bg-slate-900 text-white rounded-lg py-3 font-semibold hover:bg-slate-800'
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'employees' && !isLoggedIn && (
          <form onSubmit={handleRegister} className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <h2 className='font-semibold text-slate-800'>Add your employees</h2>
            <p className='text-sm text-slate-500'>
              Paste one email per line (or comma-separated). Each person receives a unique invite link.
            </p>
            <textarea
              value={employeeEmails}
              onChange={(e) => setEmployeeEmails(e.target.value)}
              rows={8}
              placeholder={'alex@company.com\njordan@company.com'}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm'
            />
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => setStep('admin')}
                className='flex-1 border border-slate-300 rounded-lg py-3 font-semibold text-slate-700'
              >
                Back
              </button>
              <button
                type='submit'
                disabled={loading}
                className='flex-1 bg-slate-900 text-white rounded-lg py-3 font-semibold hover:bg-slate-800 disabled:opacity-50'
              >
                {loading ? 'Creating organization...' : 'Create org & send invites'}
              </button>
            </div>
          </form>
        )}

        {step === 'employees' && isLoggedIn && (
          <form onSubmit={handleAddEmployees} className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <h2 className='font-semibold text-slate-800'>Invite more employees</h2>
            <textarea
              value={employeeEmails}
              onChange={(e) => setEmployeeEmails(e.target.value)}
              rows={6}
              placeholder='employee@company.com'
              className='w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm'
            />
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-slate-900 text-white rounded-lg py-3 font-semibold hover:bg-slate-800 disabled:opacity-50'
            >
              {loading ? 'Sending...' : 'Send invites'}
            </button>
          </form>
        )}

        {step === 'done' && result && (
          <div className='bg-white rounded-2xl shadow p-6 space-y-4'>
            <h2 className='font-semibold text-slate-800'>
              {result.invites.length ? 'Invite links ready' : 'Organization created'}
            </h2>
            <p className='text-sm text-slate-600'>
              Organization ID: <code className='bg-slate-100 px-2 py-0.5 rounded'>{result.org_id}</code>
            </p>
            {result.invites.length > 0 ? (
              <ul className='space-y-3 max-h-80 overflow-y-auto'>
                {result.invites.map((inv) => (
                  <li key={inv.invite_token} className='border border-slate-200 rounded-lg p-3 text-sm'>
                    <div className='font-medium text-slate-800'>{inv.email}</div>
                    <div className='text-xs text-slate-500 mt-1 capitalize'>Status: {inv.status}</div>
                    <input
                      readOnly
                      value={inviteLink(inv.invite_token)}
                      className='mt-2 w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1'
                      onFocus={(e) => e.target.select()}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-sm text-slate-500'>
                No invites yet. You can add employees anytime from this page.
              </p>
            )}
            <div className='flex flex-wrap gap-3 pt-2'>
              <button
                type='button'
                onClick={() => {
                  setStep('employees');
                  setEmployeeEmails('');
                }}
                className='border border-slate-300 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700'
              >
                Add more
              </button>
              <button
                type='button'
                onClick={() => router.push('/org/roster')}
                className='bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-semibold'
              >
                Go to roster
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
