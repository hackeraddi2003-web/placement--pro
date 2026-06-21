-- ============================================================
-- PlacementOS Pro — Supabase Schema
-- Run this entire file in Supabase SQL Editor (one paste, one run)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (

  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  target_role text default 'SDE / AI-ML Engineer',
  target_companies text[] default '{}',
  ai_provider text default 'none',        -- 'none' | 'gemini' | 'openai' | 'claude'
  ai_api_key_encrypted text,               -- stored client-side encrypted, see lib/crypto.js
  theme_preference text default 'system', -- 'light' | 'dark' | 'system'
  streak_count integer default 0,
  longest_streak integer default 0,
  last_active_date date,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

-- Auto-create profile row on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. DAILY JOURNAL
-- ============================================================
create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_date date not null,
  mood smallint check (mood between 1 and 5),
  energy_level smallint check (energy_level between 1 and 5),
  studied text,
  learned text,
  biggest_win text,
  biggest_mistake text,
  challenges text,
  tomorrow_target text,
  notes text,
  study_hours numeric(4,1) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

alter table journal_entries enable row level security;
create policy "Users manage own journal" on journal_entries
  for all using (auth.uid() = user_id);

create index idx_journal_user_date on journal_entries(user_id, entry_date desc);

-- ============================================================
-- 3. ENGLISH COMMUNICATION HUB
-- ============================================================
create table english_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null default current_date,
  speaking_minutes integer default 0,
  writing_minutes integer default 0,
  vocab_words text[] default '{}',
  grammar_mistakes text[] default '{}',
  confidence_score smallint check (confidence_score between 1 and 10),
  task_type text,            -- 'speak_topic' | 'describe_project' | 'explain_dsa' | 'hr_practice'
  task_prompt text,
  task_response text,
  ai_feedback text,
  created_at timestamptz default now()
);

alter table english_logs enable row level security;
create policy "Users manage own english logs" on english_logs
  for all using (auth.uid() = user_id);

create index idx_english_user_date on english_logs(user_id, log_date desc);

-- ============================================================
-- 4. LEETCODE / PROBLEMS (separate table for LeetCode note-taking)
-- ============================================================
create table leetcode_problems (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  question_title text not null,
  problem_url text,
  platform text default 'LeetCode', -- future: CodeChef/CF/etc
  difficulty text, -- 'Easy' | 'Medium' | 'Hard'

  approach text,    -- your written approach/plan
  code_solution text, -- code snippet
  mistakes text,   -- common mistakes + how you fixed them
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table leetcode_problems enable row level security;
create policy "Users manage own leetcode problems" on leetcode_problems
  for all using (auth.uid() = user_id);

create index idx_leetcode_user_platform on leetcode_problems(user_id, platform);
create index idx_leetcode_user_difficulty on leetcode_problems(user_id, difficulty);

-- ============================================================
-- 5. DSA / LEETCODE TOPIC TRACKER
-- ============================================================

create table dsa_topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic_name text not null,   -- 'Arrays', 'Strings', 'HashMap', etc.
  status text default 'not_started', -- 'not_started' | 'in_progress' | 'completed' | 'revision_needed'
  progress_pct smallint default 0 check (progress_pct between 0 and 100),
  notes text,
  problems_solved integer default 0,
  weak_areas text,
  last_revised date,
  next_revision date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, topic_name)
);

alter table dsa_topics enable row level security;
create policy "Users manage own dsa topics" on dsa_topics
  for all using (auth.uid() = user_id);

create table dsa_problems (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic_id uuid references dsa_topics(id) on delete cascade,
  problem_name text not null,
  difficulty text,            -- 'Easy' | 'Medium' | 'Hard'
  platform text default 'LeetCode',
  link text,
  solved_date date default current_date,
  notes text
);

alter table dsa_problems enable row level security;
create policy "Users manage own dsa problems" on dsa_problems
  for all using (auth.uid() = user_id);

-- ============================================================
-- 5. PROGRAMMING LANGUAGES TRACKER
-- ============================================================
create table language_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  language text not null,     -- 'Java','SQL','JavaScript','HTML','CSS','Python'
  current_level text default 'Beginner', -- Beginner | Intermediate | Advanced
  topics_completed text[] default '{}',
  revision_dates date[] default '{}',
  practice_log text,
  updated_at timestamptz default now(),
  unique(user_id, language)
);

alter table language_progress enable row level security;
create policy "Users manage own language progress" on language_progress
  for all using (auth.uid() = user_id);

-- ============================================================
-- 6. CORE SUBJECTS TRACKER
-- ============================================================
create table subject_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,      -- 'OOPs','DBMS','Operating System','Computer Networks'
  notes text,
  progress_pct smallint default 0 check (progress_pct between 0 and 100),
  revision_schedule date[] default '{}',
  interview_questions jsonb default '[]', -- [{question, answer, confidence}]
  updated_at timestamptz default now(),
  unique(user_id, subject)
);

alter table subject_progress enable row level security;
create policy "Users manage own subject progress" on subject_progress
  for all using (auth.uid() = user_id);

-- ============================================================
-- 7. PROJECT MANAGEMENT
-- ============================================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  tech_stack text[] default '{}',
  github_link text,
  live_link text,
  status text default 'planning', -- planning | in_progress | completed
  features text,
  learning_outcomes text,
  challenges text,
  screenshot_urls text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id);

-- ============================================================
-- 8. INTERVIEW PREPARATION HUB
-- ============================================================
create table interview_questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,     -- 'OOPs','DBMS','SQL','OS','CN','HR'
  question text not null,
  answer text,
  confidence smallint default 1 check (confidence between 1 and 5),
  last_practiced date,
  created_at timestamptz default now()
);

alter table interview_questions enable row level security;
create policy "Users manage own interview questions" on interview_questions
  for all using (auth.uid() = user_id);

create index idx_interview_user_category on interview_questions(user_id, category);

-- ============================================================
-- 9. JOB APPLICATION TRACKER
-- ============================================================
create table job_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company text not null,
  role text,
  package_lpa numeric(5,2),
  application_date date default current_date,
  stage text default 'applied', -- applied | oa | interview | offer | rejected
  oa_status text,
  interview_status text,
  result text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table job_applications enable row level security;
create policy "Users manage own job applications" on job_applications
  for all using (auth.uid() = user_id);

create index idx_jobs_user_stage on job_applications(user_id, stage);

-- ============================================================
-- 10. AI MENTOR — DAILY REVIEW
-- ============================================================
create table mentor_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  review_date date not null default current_date,
  what_did_today text,
  biggest_achievement text,
  time_wasters text,
  ai_feedback text,
  improvement_suggestions text,
  tomorrow_plan text,
  generated_by text default 'rule_based', -- 'rule_based' | 'gemini' | 'openai' | 'claude'
  created_at timestamptz default now(),
  unique(user_id, review_date)
);

alter table mentor_reviews enable row level security;
create policy "Users manage own mentor reviews" on mentor_reviews
  for all using (auth.uid() = user_id);

-- ============================================================
-- 11. DAILY TASKS (for Dashboard "Today's Tasks" + streaks)
-- ============================================================
create table daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  task_date date not null default current_date,
  title text not null,
  category text default 'general', -- dsa | english | project | interview | general
  is_completed boolean default false,
  priority smallint default 2,     -- 1 high, 2 medium, 3 low
  created_at timestamptz default now()
);

alter table daily_tasks enable row level security;
create policy "Users manage own daily tasks" on daily_tasks
  for all using (auth.uid() = user_id);

create index idx_tasks_user_date on daily_tasks(user_id, task_date);

-- ============================================================
-- 12. GOALS (Dashboard "Upcoming Goals")
-- ============================================================
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  target_date date,
  is_completed boolean default false,
  category text default 'general',
  created_at timestamptz default now()
);

alter table goals enable row level security;
create policy "Users manage own goals" on goals
  for all using (auth.uid() = user_id);

-- ============================================================
-- 13. DAILY TASKS STATS (Dashboard completion %)
-- ============================================================
create table daily_task_stats (
  user_id uuid references auth.users(id) on delete cascade not null,
  task_date date not null,
  total_tasks integer default 0,
  completed_tasks integer default 0,
  completion_pct integer default 0 check (completion_pct between 0 and 100),
  updated_at timestamptz default now(),
  primary key (user_id, task_date)
);

alter table daily_task_stats enable row level security;
create policy "Users manage own daily task stats" on daily_task_stats
  for all using (auth.uid() = user_id);

create index idx_task_stats_user_date on daily_task_stats(user_id, task_date desc);

-- ============================================================
-- DONE. Verify: Table Editor should show 13 tables, all RLS-enabled.
-- ============================================================
