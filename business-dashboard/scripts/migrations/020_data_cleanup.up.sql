-- 020 up  One-time cleanup of production data (dashboard redesign, piece 1).
-- Decisions are Taylor's, recorded in
-- docs/superpowers/specs/2026-10-28-dashboard-redesign-design.md.
--
-- Every record is found by name and must match exactly one row, or the whole
-- file rolls back. Contains plpgsql, so run-migration.mjs runs it as one
-- statement. Run 019 first.

create function pg_temp.one(q text, what text) returns uuid
language plpgsql as $$
declare
  ids uuid[];
begin
  execute 'select array_agg(id) from (' || q || ') s' into ids;
  if coalesce(array_length(ids, 1), 0) <> 1 then
    raise exception 'Cleanup expected exactly one %, found %', what, coalesce(array_length(ids, 1), 0);
  end if;
  return ids[1];
end $$;

do $$
declare
  c_interior uuid := pg_temp.one($q$select id from clients where company = 'Interior Jade'$q$, 'client Interior Jade');
  c_jades    uuid := pg_temp.one($q$select id from clients where company = 'Jades Interior'$q$, 'client Jades Interior');
  l_jade     uuid := pg_temp.one($q$select id from leads where business_name = 'Jades Interior'$q$, 'lead Jades Interior');
  c_house    uuid := pg_temp.one($q$select id from clients where company = 'house hunters'$q$, 'client house hunters');
  l_house    uuid := pg_temp.one($q$select id from leads where business_name = 'house hunters'$q$, 'lead house hunters');
  c_zkn      uuid := pg_temp.one($q$select id from clients where company = 'ZKN caffe'$q$, 'client ZKN caffe');
  l_zkn      uuid := pg_temp.one($q$select id from leads where business_name = 'ZKN caffe'$q$, 'lead ZKN caffe');
  l_five     uuid := pg_temp.one($q$select id from leads where business_name = 'Five Islands'$q$, 'lead Five Islands');
  p_five     uuid := pg_temp.one($q$select id from projects where name = 'Five islands Webstite'$q$, 'project Five islands Webstite');
  p_aero     uuid := pg_temp.one($q$select id from projects where name = 'Aeromarine Ltd. Website'$q$, 'project Aeromarine Ltd. Website');
  c_gli      uuid := pg_temp.one($q$select id from clients where company = 'GLISCORE'$q$, 'client GLISCORE');
  l_gli      uuid := pg_temp.one($q$select id from leads where business_name = 'GLISCORE Industrial sourcing'$q$, 'lead GLISCORE');
  i_gli      uuid := pg_temp.one($q$select id from invoices where invoice_number = 'INV-0018'$q$, 'invoice INV-0018');
  c_taylor   uuid := pg_temp.one($q$select id from clients where company = 'Taylor Engineering'$q$, 'client Taylor Engineering');
  c_decle    uuid := pg_temp.one($q$select id from clients where company = 'Decle Realty'$q$, 'client Decle Realty');
  c_cole     uuid := pg_temp.one($q$select id from clients where company = 'COLE Safety'$q$, 'client COLE Safety');
  p_cole     uuid := pg_temp.one($q$select id from projects where name = 'Cole Saftey'$q$, 'project Cole Saftey');
  i_cole     uuid := pg_temp.one($q$select id from invoices where invoice_number = 'INV-002'$q$, 'invoice INV-002');
  leads_only uuid[];
  c          uuid;
  l_new      uuid;
  p_taylor   uuid;
  p_decle    uuid;
  n          int;
  r          record;
  t          text;
begin
  -- Jade: the empty duplicate client goes; the Won lead points at Interior Jade.
  select count(*) into n from projects where client_id = c_jades;
  if n > 0 then raise exception 'Jades Interior client unexpectedly has % projects', n; end if;
  select count(*) into n from invoices where client_id = c_jades;
  if n > 0 then raise exception 'Jades Interior client unexpectedly has % invoices', n; end if;
  update leads set client_id = c_interior where id = l_jade;
  delete from clients where id = c_jades;

  -- house hunters: keep both, linked.
  update leads set client_id = c_house where id = l_house;

  -- Collabr, Fresh Start, PBS: become leads (Contacted); projects move to the lead.
  leads_only := array[
    pg_temp.one($q$select id from clients where company = 'Collabr'$q$, 'client Collabr'),
    pg_temp.one($q$select id from clients where company = 'Fresh Start Natural Juices'$q$, 'client Fresh Start'),
    pg_temp.one($q$select id from clients where company = 'PBS'$q$, 'client PBS')
  ];
  foreach c in array leads_only loop
    insert into leads (name, business_name, email, phone_whatsapp, status, source)
    select name, company, email, phone, 'Contacted', 'Moved from client record' from clients where id = c
    returning id into l_new;
    update projects set lead_id = l_new, client_id = null where client_id = c;
  end loop;

  -- ZKN: lead only. Project to the lead; the void invoice keeps its project.
  update projects set lead_id = l_zkn, client_id = null where client_id = c_zkn;
  update invoices set client_id = null where client_id = c_zkn;
  update leads set client_id = null where id = l_zkn;
  leads_only := leads_only || c_zkn;

  -- The four client records are now empty. Refuse if anything still uses them.
  select count(*) into n from (
    select 1 from projects where client_id = any(leads_only)
    union all select 1 from invoices where client_id = any(leads_only)
    union all select 1 from subscriptions where client_id = any(leads_only)
    union all select 1 from leads where client_id = any(leads_only)
    union all select 1 from client_entries where client_id = any(leads_only)
    union all select 1 from client_promises where client_id = any(leads_only)
  ) x;
  if n > 0 then raise exception 'Clients moved to leads are still referenced by % rows', n; end if;
  delete from clients where id = any(leads_only);

  -- Five Islands: the project belongs to the lead. Typo fixed.
  update projects set lead_id = l_five, name = 'Five Islands Website' where id = p_five;

  -- Aeromarine: new Lost lead owns the cancelled project.
  insert into leads (name, business_name, status, source)
  values ('Robert Llanos', 'Aeromarine', 'Lost', 'Moved from project record')
  returning id into l_new;
  update projects set lead_id = l_new where id = p_aero;

  -- Internal projects.
  update projects set internal = true where name in ('CariPromos', 'Cruz');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Expected 2 internal projects, marked %', n; end if;

  -- GLISCORE: lead linked; INV-0018 gets its client from its project.
  update leads set client_id = c_gli where id = l_gli;
  update invoices set client_id = c_gli where id = i_gli;

  -- Invoices with no project.
  insert into projects (name, client_id, status) values ('Taylor Engineering Website', c_taylor, 'Done') returning id into p_taylor;
  insert into projects (name, client_id, status) values ('Decle Realty Website', c_decle, 'Done') returning id into p_decle;
  update invoices set project_id = p_taylor where client_id = c_taylor and project_id is null;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Expected 2 Taylor Engineering invoices without a project, found %', n; end if;
  update invoices set project_id = p_decle where client_id = c_decle and project_id is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected 1 Decle Realty invoice without a project, found %', n; end if;
  update invoices set project_id = p_cole where id = i_cole;

  -- Typo.
  update projects set name = 'Cole Safety' where id = p_cole;

  -- Renumber. Issued (Sent, Overdue, Paid) → INV-0001…, voided → VOID-0001…,
  -- oldest issue date first, no date last, ties by sort_key. Old number kept
  -- as the first line of notes. Drafts untouched.
  create temp table invoice_renumber on commit drop as
  select id, invoice_number as old,
         case when status = 'Void' then 'VOID-' else 'INV-' end
           || lpad((row_number() over (partition by (status = 'Void')
                                       order by issue_date nulls last, sort_key, id))::text, 4, '0') as new
    from invoices
   where status in ('Sent', 'Overdue', 'Paid', 'Void');

  -- Old numbers mentioned in free text become the new numbers. Case-sensitive
  -- (INV-0018 and Inv-0018 are different invoices), whole tokens only (INV-0017
  -- never hits INV-0017-B, dates are never touched). Two phases so a chain
  -- (old INV-0014 → INV-0010 while old INV-0017 → INV-0014) cannot happen:
  -- old number → unique placeholder, longest first, then placeholder → new.
  for r in select id, old, new from invoice_renumber where old is not null order by length(old) desc, old loop
    foreach t in array array['invoices.notes', 'subscriptions.notes', 'payments.note', 'projects.notes'] loop
      execute format('update %I set %I = regexp_replace(%2$I, $1, $2, ''g'') where %2$I ~ $1',
                     split_part(t, '.', 1), split_part(t, '.', 2))
        using '(?<![A-Za-z0-9-])' || regexp_replace(r.old, '([^A-Za-z0-9])', '\\\1', 'g') || '(?![A-Za-z0-9-])',
              chr(1) || r.id || chr(1);
    end loop;
  end loop;
  for r in select id, new from invoice_renumber loop
    foreach t in array array['invoices.notes', 'subscriptions.notes', 'payments.note', 'projects.notes'] loop
      execute format('update %I set %I = replace(%2$I, $1, $2) where strpos(%2$I, $1) > 0',
                     split_part(t, '.', 1), split_part(t, '.', 2))
        using chr(1) || r.id || chr(1), r.new;
    end loop;
  end loop;

  perform set_config('invoices.renumber', 'on', true);
  update invoices i
     set invoice_number = m.new,
         notes = case when m.old is null then 'Previously unnumbered.' else 'Previously issued as ' || m.old || '.' end
                 || coalesce(E'\n' || i.notes, '')
    from invoice_renumber m
   where m.id = i.id;
  perform set_config('invoices.renumber', 'off', true);
end $$;

-- From now on no two invoices share a number, ignoring case.
create unique index invoices_number_unique on invoices (lower(invoice_number));
