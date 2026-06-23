#!/usr/bin/env python3
"""Seed a demo organization, org admin, and link an existing candidate.

Usage (from Backend/):
  py scripts/seed_org_admin.py --email admin@acme.com --password secret123

Requires SUPABASE_URL and SUPABASE_KEY in environment.
"""

import argparse
import uuid

import bcrypt

from services.supabase_client import supabase


def main() -> None:
    parser = argparse.ArgumentParser(description='Seed org portal demo data')
    parser.add_argument('--email', default='orgadmin@demo.com')
    parser.add_argument('--password', default='DemoAdmin123!')
    parser.add_argument('--org-name', default='Demo Organization')
    parser.add_argument('--candidate-email', help='Link existing candidate by email')
    args = parser.parse_args()

    org_rows = (
        supabase.table('organizations')
        .insert({'name': args.org_name, 'contact_email': args.email, 'plan': 'team'})
        .execute()
        .data
    )
    org_id = org_rows[0]['id']
    print(f'Created organization: {org_id}')

    hashed = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode()
    admin_rows = (
        supabase.table('org_admins')
        .insert({
            'id': str(uuid.uuid4()),
            'org_id': org_id,
            'email': args.email,
            'password_hash': hashed,
            'role': 'org_admin',
            'first_name': 'Org',
            'last_name': 'Admin',
        })
        .execute()
        .data
    )
    admin_id = admin_rows[0]['id']
    print(f'Created org admin: {admin_id}')
    print(f'Login with organization_id={org_id} email={args.email}')

    if args.candidate_email:
        cand = (
            supabase.table('candidates')
            .select('id')
            .eq('email', args.candidate_email)
            .limit(1)
            .execute()
            .data
        )
        if cand:
            cid = cand[0]['id']
            supabase.table('org_members').insert({
                'org_id': org_id,
                'candidate_id': cid,
                'pipeline_stage': 'Emerging',
            }).execute()
            supabase.table('candidates').update({'org_id': org_id}).eq('id', cid).execute()
            print(f'Linked candidate {cid}')


if __name__ == '__main__':
    main()
