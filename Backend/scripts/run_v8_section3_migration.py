#!/usr/bin/env py
"""Apply v8 Section 3 additive migrations to Supabase Postgres."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

MIGRATION_FILE = Path(__file__).resolve().parent.parent / 'migrations' / 'v8_section3_additive.sql'
PROJECT_REF = os.getenv('SUPABASE_PROJECT_REF', 'jopdmaugcuqukyzfizwx')


def split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('--'):
            continue
        buffer.append(line)
        if stripped.endswith(';'):
            statement = '\n'.join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
    if buffer:
        statement = '\n'.join(buffer).strip()
        if statement:
            statements.append(statement)
    return statements


def run_with_psycopg2(statements: list[str]) -> bool:
    password = os.getenv('SUPABASE_DB_PASSWORD')
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DB_URL')
    if not database_url and password:
        host = os.getenv('SUPABASE_DB_HOST', 'aws-0-us-east-1.pooler.supabase.com')
        port = os.getenv('SUPABASE_DB_PORT', '6543')
        user = os.getenv('SUPABASE_DB_USER', f'postgres.{PROJECT_REF}')
        dbname = os.getenv('SUPABASE_DB_NAME', 'postgres')
        database_url = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'

    if not database_url:
        return False

    try:
        import psycopg2
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary', '-q'])
        import psycopg2

    with psycopg2.connect(database_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for statement in statements:
                cur.execute(statement)
    return True


def run_with_management_api(statements: list[str]) -> bool:
    token = os.getenv('SUPABASE_ACCESS_TOKEN')
    if not token:
        return False

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    url = f'https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query'
    with httpx.Client(timeout=60.0) as client:
        for statement in statements:
            response = client.post(url, headers=headers, json={'query': statement})
            if response.status_code >= 400:
                raise RuntimeError(f'Management API error {response.status_code}: {response.text}')
    return True


def verify_tables() -> None:
    from supabase import create_client

    sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    tables = [
        'assessments',
        'action_plans',
        'action_items',
        'organizations',
        'org_members',
        'reports',
        'audit_events',
    ]
    for table in tables:
        sb.table(table).select('id').limit(0).execute()
        print(f'  ok: {table}')


def main() -> int:
    if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_KEY'):
        raise SystemExit('SUPABASE_URL and SUPABASE_KEY are required in Backend/.env')

    sql = MIGRATION_FILE.read_text(encoding='utf-8')
    statements = split_sql_statements(sql)
    print(f'Applying {MIGRATION_FILE.name} ({len(statements)} statements)...')

    if run_with_psycopg2(statements):
        print('Migration applied via direct Postgres connection.')
    elif run_with_management_api(statements):
        print('Migration applied via Supabase Management API.')
    else:
        raise SystemExit(
            'Could not run migration. Add one of:\n'
            '  - SUPABASE_DB_PASSWORD (or DATABASE_URL) in Backend/.env\n'
            '  - SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens'
        )

    print('Verifying tables...')
    verify_tables()
    print('Done.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
