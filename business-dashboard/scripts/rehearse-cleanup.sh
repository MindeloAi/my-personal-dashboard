#!/usr/bin/env bash
# rehearse-cleanup.sh — restore a READ-ONLY dump of production into a local
# Docker Postgres, apply 019 and 020 there, and print every changed record.
# Never writes to production. Also leaves the dump in ../backups/ as the
# restore point for 020.
#
#   bash scripts/rehearse-cleanup.sh <path to .env.local that has DIRECT_URL>
set -euo pipefail
ENV_FILE="$1"
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2-)
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ../backups
DUMP=../backups/prod-public-$STAMP.sql
LOCAL=postgres://postgres:pg@localhost:55434/postgres

docker run --rm postgres:17 pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges > "$DUMP"
echo "Dump: $DUMP ($(wc -l < "$DUMP") lines)"

docker rm -f rehearse-pg >/dev/null 2>&1 || true
docker run -d --name rehearse-pg -e POSTGRES_PASSWORD=pg -p 55434:5432 postgres:17 >/dev/null
for i in $(seq 1 30); do docker exec rehearse-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 2
docker exec rehearse-pg psql -U postgres -q -c "create role anon; create role authenticated;"
# Foreign keys into Supabase's auth schema do not exist locally; those few
# statements fail and are skipped. Everything the cleanup touches restores.
docker exec -i rehearse-pg psql -U postgres -q < "$DUMP" 2>&1 | grep -v 'schema "auth" does not exist' | tail -5 || true

snapshot() {
  docker exec rehearse-pg psql -U postgres -At -F ' | ' -c "
    select 'client', coalesce(company, name), status from clients
    union all select 'lead', coalesce(business_name, name), status || ' -> client ' || coalesce((select coalesce(company, name) from clients c where c.id = l.client_id), '-') from leads l
    union all select 'project', name, coalesce((select 'client ' || coalesce(company, name) from clients c where c.id = p.client_id),
                                              (select 'lead ' || coalesce(business_name, name) from leads l where l.id = p.lead_id), '-')
                                     || case when p.internal then ' (internal)' else '' end from projects p
    union all select 'invoice', coalesce(invoice_number, '(none)'), status || ' ' || amount || ' ' || split_part(coalesce(notes, ''), E'\n', 1) from invoices
    order by 1, 2;" 2>/dev/null
}

snapshot > /tmp/rehearse-before.txt || true
echo "Business cash before 019/020: $(docker exec rehearse-pg psql -U postgres -At -c "select 'business ' || business || ', total ' || total from business_cash")"
DIRECT_URL=$LOCAL node scripts/run-migration.mjs scripts/migrations/019_links_and_numbering.up.sql
snapshot > /tmp/rehearse-mid.txt
DIRECT_URL=$LOCAL node scripts/run-migration.mjs scripts/migrations/020_data_cleanup.up.sql
snapshot > /tmp/rehearse-after.txt

echo; echo "===== CHANGES (- before, + after) ====="
diff /tmp/rehearse-mid.txt /tmp/rehearse-after.txt || true
echo; echo "===== CHECKS ====="
docker exec rehearse-pg psql -U postgres -At -c "
  select 'issued invoices ' || count(*) || ', numbered INV-0001..' || max(invoice_number) from invoices where status in ('Sent','Overdue','Paid');
  select 'voided invoices ' || count(*) || ', numbered ' || string_agg(invoice_number, ',' order by invoice_number) from invoices where status = 'Void';
  select 'invoices with duplicate numbers: ' || count(*) from (select lower(invoice_number) from invoices group by 1 having count(*) > 1) d;
  select 'business cash ' || (select business from business_cash) || ', total ' || (select total from business_cash);"
docker exec rehearse-pg psql -U postgres -At -c "insert into invoices (amount, status, issue_date) values (1, 'Sent', current_date) returning 'next new invoice gets ' || invoice_number;"
