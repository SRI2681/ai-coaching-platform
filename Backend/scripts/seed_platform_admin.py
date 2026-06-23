#!/usr/bin/env python3
"""Seed a platform super-admin account.

Usage (from Backend/):
  py scripts/seed_platform_admin.py --email admin@platform.com --password Admin123!
"""

import argparse
import uuid

import bcrypt

from services.supabase_client import supabase


def main() -> None:
    parser = argparse.ArgumentParser(description='Seed platform super-admin')
    parser.add_argument('--email', default='platform@admin.com')
    parser.add_argument('--password', default='PlatformAdmin123!')
    parser.add_argument('--first-name', default='Platform')
    parser.add_argument('--last-name', default='Admin')
    args = parser.parse_args()

    email = args.email.strip().lower()
    hashed = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode()

    existing = (
        supabase.table('platform_admins')
        .select('id')
        .eq('email', email)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        supabase.table('platform_admins').update({
            'password_hash': hashed,
            'first_name': args.first_name,
            'last_name': args.last_name,
            'role': 'super_admin',
        }).eq('id', existing[0]['id']).execute()
        print(f'Updated platform admin: {existing[0]["id"]}')
    else:
        row = (
            supabase.table('platform_admins')
            .insert({
                'id': str(uuid.uuid4()),
                'email': email,
                'password_hash': hashed,
                'role': 'super_admin',
                'first_name': args.first_name,
                'last_name': args.last_name,
            })
            .execute()
            .data[0]
        )
        print(f'Created platform admin: {row["id"]}')

    print(f'Login as Platform Admin with email={email}')


if __name__ == '__main__':
    main()
