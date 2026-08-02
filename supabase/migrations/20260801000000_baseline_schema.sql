-- Baseline schema snapshot — generated after RLS hardening (2025-08-01).
-- Captures the full current state: tables, constraints, indexes,
-- RLS policies (authenticated-only + public RPC), and functions.
-- Does NOT include data.

-- ── 1. Extensions ──

create extension if not exists "pgcrypto" schema "extensions";

-- ── 2. Tables ──

create table if not exists public.knowledge_base (
  id uuid not null default gen_random_uuid(),
  services jsonb not null default '[]'::jsonb,
  pricing_ranges jsonb not null default '[]'::jsonb,
  availability text not null default ''::text,
  out_of_scope_rules jsonb not null default '[]'::jsonb,
  past_projects jsonb not null default '[]'::jsonb,
  referral_contacts jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint knowledge_base_pkey primary key (id)
);

alter table public.knowledge_base enable row level security;

create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  visitor_id text not null default ''::text,
  status text not null default 'active'::text,
  qualification_checks jsonb,
  referral jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint conversations_pkey primary key (id),
  constraint conversations_status_check
    check (status = any (array['active'::text, 'qualified'::text, 'needs_info'::text, 'out_of_scope'::text, 'handled'::text, 'archived'::text]))
);

alter table public.conversations enable row level security;

create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_conversation_id_fkey foreign key (conversation_id) references public.conversations(id) on delete cascade,
  constraint messages_role_check
    check (role = any (array['user'::text, 'assistant'::text, 'system'::text]))
);

alter table public.messages enable row level security;

create table if not exists public.briefs (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  client_contact text not null default ''::text,
  email text,
  company text,
  website text,
  project_type text not null default ''::text,
  scope_summary text not null default ''::text,
  budget text not null default ''::text,
  timeline text not null default ''::text,
  urgency text not null default ''::text,
  enrichment jsonb,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  constraint briefs_pkey primary key (id),
  constraint briefs_conversation_id_key unique (conversation_id),
  constraint briefs_conversation_id_fkey foreign key (conversation_id) references public.conversations(id)
);

alter table public.briefs enable row level security;

-- ── 3. RLS Policies ──
-- Dashboard pages use authenticated sessions (JWT from supabase-js).
-- The chat Edge Function uses the service_role key (bypasses RLS).
-- The widget restore flow calls the Edge Function (action: "history").
-- Anon key has NO direct table access except via the RPC below.

-- knowledge_base: all CRUD restricted to authenticated users only
create policy "authenticated_can_read_kb"
  on public.knowledge_base for select to authenticated using (true);

create policy "authenticated_can_insert_kb"
  on public.knowledge_base for insert to authenticated with check (true);

create policy "authenticated_can_update_kb"
  on public.knowledge_base for update to authenticated using (true);

create policy "authenticated_can_delete_kb"
  on public.knowledge_base for delete to authenticated using (true);

-- conversations: SELECT + UPDATE for authenticated users only
create policy "authenticated_can_select_conversations"
  on public.conversations for select to authenticated using (true);

create policy "authenticated_can_update_conversations"
  on public.conversations for update to authenticated using (true);

-- messages: SELECT for authenticated users only
create policy "authenticated_can_select_messages"
  on public.messages for select to authenticated using (true);

-- briefs: SELECT for authenticated users only
create policy "authenticated_can_select_briefs"
  on public.briefs for select to authenticated using (true);

-- ── 4. Public RPC for token-accessed briefs ──
-- SECURITY DEFINER: runs as owner (postgres), bypasses RLS.
-- Only returns a row when the share_token matches exactly, so anon users
-- cannot enumerate briefs; they can only view one they have the URL for.

create or replace function public.get_shared_brief(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_brief public.briefs%rowtype;
  v_status text;
  v_checks jsonb;
begin
  select b.* into v_brief
  from public.briefs b
  where b.share_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  select c.status, c.qualification_checks
  into v_status, v_checks
  from public.conversations c
  where c.id = v_brief.conversation_id;

  return jsonb_build_object(
    'brief', to_jsonb(v_brief),
    'status', coalesce(v_status, 'active'),
    'qualification_checks', v_checks
  );
end;
$$;

revoke all on function public.get_shared_brief(uuid) from public;
grant execute on function public.get_shared_brief(uuid) to anon, authenticated;