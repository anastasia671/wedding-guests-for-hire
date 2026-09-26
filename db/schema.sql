create extension if not exists "pgcrypto";

create type employee_role as enum ('manager', 'salesperson', 'expense_reporter');
create type project_code as enum ('A', 'B');
create type sale_status as enum ('pending', 'approved');
create type expense_status as enum ('awaiting_allocation', 'allocated');
create type expense_category as enum ('Materials', 'Travel', 'Other');
create type allocation_code as enum ('A', 'B', 'overhead');
create type sync_state as enum ('synced', 'pending', 'failed');
create type delivery_state as enum ('not_required', 'pending', 'sent', 'failed');

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role employee_role not null,
  telegram_user_id bigint unique,
  telegram_chat_id bigint,
  created_at timestamptz not null default now()
);

create table sales (
  reference text primary key check (reference ~ '^S[0-9]+$'),
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references employees(id),
  telegram_chat_id bigint,
  customer text not null,
  project project_code not null,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  proposed_richard numeric(5,2) not null check (proposed_richard between 0 and 100),
  proposed_anastasia numeric(5,2) not null check (proposed_anastasia between 0 and 100),
  proposed_jean_claude numeric(5,2) not null check (proposed_jean_claude between 0 and 100),
  approved_richard numeric(5,2),
  approved_anastasia numeric(5,2),
  approved_jean_claude numeric(5,2),
  status sale_status not null default 'pending',
  sync_status sync_state not null default 'pending',
  notification_status delivery_state not null default 'not_required',
  constraint proposed_total check (proposed_richard + proposed_anastasia + proposed_jean_claude = 100),
  constraint approved_total check (approved_richard is null or approved_richard + approved_anastasia + approved_jean_claude = 100)
);

create table expenses (
  reference text primary key check (reference ~ '^E[0-9]+$'),
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references employees(id),
  telegram_chat_id bigint,
  description text not null,
  category expense_category not null,
  amount_cents integer not null check (amount_cents > 0),
  proposed_allocation allocation_code not null,
  final_allocation allocation_code,
  status expense_status not null,
  sync_status sync_state not null default 'pending',
  notification_status delivery_state not null default 'not_required'
);

-- Run once after schema creation. These UUIDs are intentionally stable for the demo-role selector.
insert into employees (id, name, role) values
  ('00000000-0000-4000-8000-000000000001', 'Richard Darling', 'salesperson'),
  ('00000000-0000-4000-8000-000000000002', 'Anastasia Ferrari', 'salesperson'),
  ('00000000-0000-4000-8000-000000000003', 'Jean-Claude Berzins', 'salesperson'),
  ('00000000-0000-4000-8000-000000000004', 'Kevin von Whatever', 'expense_reporter'),
  ('00000000-0000-4000-8000-000000000005', 'Svetlana de Monte Carlo', 'manager')
on conflict (id) do nothing;
