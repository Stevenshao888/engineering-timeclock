-- Employee Attendance App Schema

-- 1. Work Sites Table
create table public.work_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 500,
  created_at timestamptz default now()
);

-- 2. Profiles Table (Linked to auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  daily_wage numeric, -- Renamed from hourly_rate
  default_site_id uuid references public.work_sites(id),
  role text default 'employee', -- 'employee' or 'admin'
  updated_at timestamptz
);

-- 3. Attendance Logs Table
create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  gps_lat double precision, -- Keeping for backward compatibility or general ref
  gps_long double precision, -- Keeping for backward compatibility
  in_latitude double precision,
  in_longitude double precision,
  out_latitude double precision,
  out_longitude double precision,
  photo_url text,
  status text, -- 'on-time', 'late'
  photo_url text,
  status text, -- 'on-time', 'late'
  bonus_hours double precision default 0,
  work_area text, -- Specific area at the site
  cash_advance double precision default 0, -- Deductions
  created_at timestamptz default now()
);

-- Note: In profiles, we are technically adding/renaming to daily_wage.
-- For new deployments:
-- hourly_rate numeric -> daily_wage numeric

-- Indexes for performance
create index idx_attendance_user on public.attendance_logs(user_id);
create index idx_attendance_created on public.attendance_logs(created_at);

-- Enable Row Level Security
alter table public.work_sites enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance_logs enable row level security;

-- Helper function to check if user is admin (Security Definer to bypass RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- RLS Policies

-- WORK SITES
-- Authenticated users can view sites (to check if they are in range)
create policy "Authenticated users can view work sites"
  on public.work_sites for select
  to authenticated
  using (true);

-- Only admins can manage sites
create policy "Admins can manage work sites"
  on public.work_sites for all
  using (public.is_admin());

-- PROFILES
-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admins can update all profiles
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- ATTENDANCE LOGS
-- Users can view their own logs
create policy "Users can view own logs"
  on public.attendance_logs for select
  using (auth.uid() = user_id);

-- Admins can view all logs
create policy "Admins can view all logs"
  on public.attendance_logs for select
  using (public.is_admin());

-- Users can create their own logs
create policy "Users can insert own logs"
  on public.attendance_logs for insert
  with check (auth.uid() = user_id);

-- Users can update their own logs (e.g. check-out)
create policy "Users can update own logs"
  on public.attendance_logs for update
  using (auth.uid() = user_id);


-- Trigger to create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'employee');
  return new;
end;
$$;

-- Drop trigger if exists to prevent errors on re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'daily'; ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_wage numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'daily'; ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_wage numeric DEFAULT 0;
