#!/usr/bin/env python3
"""
generate-branch-wrangler.py — derive a branch-specific wrangler.jsonc from
the source wrangler.jsonc, replacing worker name / D1 ids / KV ids /
resource names with branch-slug variants.

Usage:
  generate-branch-wrangler.py \
    --base <path/to/wrangler.jsonc> \
    --slug <branch-slug> \
    --db-id <branch-d1-uuid> \
    --kv-id <branch-kv-id> \
    --out <path/to/wrangler.branch.jsonc>

The output is a flat wrangler config (no env blocks) targeting branch resources.
Used by scripts/branch-env.sh deploy.
"""

from __future__ import annotations

import argparse
import json
import re
import sys


def strip_jsonc(text: str) -> str:
    out: list[str] = []
    i = 0
    n = len(text)
    in_string = False
    escape = False
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if escape:
            out.append(ch)
            escape = False
            i += 1
            continue
        if in_string:
            if ch == '\\':
                escape = True
            elif ch == '"':
                in_string = False
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == '/' and nxt == '/':
            j = text.find('\n', i)
            i = n if j == -1 else j
            continue
        if ch == '/' and nxt == '*':
            j = text.find('*/', i + 2)
            i = n if j == -1 else j + 2
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True)
    ap.add_argument('--slug', required=True)
    ap.add_argument('--db-id', required=True)
    ap.add_argument('--kv-id', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    with open(args.base) as f:
        raw = f.read()
    clean = re.sub(r',(\s*[}\]])', r'\1', strip_jsonc(raw))
    cfg = json.loads(clean)

    base_name = cfg.get('name', '')
    # debatekit-api → debatekit-api-br-<slug>
    if not base_name:
        print('ERROR: base wrangler.jsonc has no `name`', file=sys.stderr)
        return 1
    cfg['name'] = f'{base_name}-br-{args.slug}'

    # drop env blocks — branch config is flat
    cfg.pop('env', None)

    # drop paid-plan-only fields
    cfg.pop('placement', None)
    cfg.pop('limits', None)

    # also drop r2_buckets, queues, durable_objects (Workers Paid required)
    cfg.pop('r2_buckets', None)
    cfg.pop('queues', None)
    cfg.pop('durable_objects', None)
    cfg.pop('migrations', None)

    # branch-specific D1
    if 'd1_databases' in cfg:
        for db in cfg['d1_databases']:
            if db.get('binding') == 'DB':
                db['database_name'] = f'debatekit-dashboard-db-br-{args.slug}'
                db['database_id'] = args.db_id
                db['preview_database_id'] = args.db_id

    # branch-specific KV
    if 'kv_namespaces' in cfg:
        for kv in cfg['kv_namespaces']:
            if kv.get('binding') == 'KV':
                kv['id'] = args.kv_id
                kv['preview_id'] = args.kv_id

    # rewrite WEBAPP_ENV var so app knows it's in a branch env
    vars_block = cfg.get('vars', {})
    if 'WEBAPP_ENV' in vars_block:
        vars_block['WEBAPP_ENV'] = f'br-{args.slug}'
    if 'VITE_WEBAPP_ENV' in vars_block:
        vars_block['VITE_WEBAPP_ENV'] = f'br-{args.slug}'
    cfg['vars'] = vars_block

    # ensure workers_dev = true so we get a workers.dev URL
    cfg['workers_dev'] = True
    # drop any routes (no Custom Domain attach for branch deploys)
    cfg.pop('routes', None)

    with open(args.out, 'w') as f:
        f.write(json.dumps(cfg, indent=2) + '\n')

    print(f'wrote {args.out}: name={cfg["name"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
