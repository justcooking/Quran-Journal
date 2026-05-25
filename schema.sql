-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  gender text check (gender in ('male', 'female')),
  preferred_reciter text default 'Mishary Rashid Alafasy',
  goal_months integer default 24,
  created_at timestamp with time zone default now()
);

-- Surah progress per user
create table surah_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  surah_number integer not null check (surah_number between 1 and 114),
  ayahs_memorized integer default 0,
  total_ayahs integer not null,
  percent_complete integer default 0,
  status text default 'not_started' check (status in ('not_started', 'in_progress', 'memorized')),
  last_revised_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, surah_number)
);

-- Memorization log
create table memorization_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  surah_number integer not null,
  surah_name text not null,
  ayah_from integer not null,
  ayah_to integer not null,
  confidence text check (confidence in ('weak', 'okay', 'strong', 'solid')),
  notes text,
  logged_at timestamp with time zone default now()
);

-- Revision log
create table revision_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  surah_number integer not null,
  surah_name text not null,
  confidence text check (confidence in ('weak', 'okay', 'strong', 'solid')),
  revised_at timestamp with time zone default now()
);

-- Communities
create table communities (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_by uuid references profiles(id) on delete cascade,
  is_private boolean default false,
  gender_filter text default 'mixed' check (gender_filter in ('mixed', 'brothers', 'sisters')),
  invite_code text unique default substring(md5(random()::text), 1, 8),
  created_at timestamp with time zone default now()
);

-- Community members
create table community_members (
  id uuid default uuid_generate_v4() primary key,
  community_id uuid references communities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone default now(),
  unique(community_id, user_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table surah_progress enable row level security;
alter table memorization_logs enable row level security;
alter table revision_logs enable row level security;
alter table communities enable row level security;
alter table community_members enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

-- Surah progress policies
create policy "Users can view own progress" on surah_progress for select using (auth.uid() = user_id);
create policy "Community members can view each other" on surah_progress for select using (
  exists (
    select 1 from community_members cm1
    join community_members cm2 on cm1.community_id = cm2.community_id
    where cm1.user_id = auth.uid() and cm2.user_id = surah_progress.user_id
  )
);
create policy "Users can insert own progress" on surah_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on surah_progress for update using (auth.uid() = user_id);

-- Memorization log policies
create policy "Users can view own logs" on memorization_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on memorization_logs for insert with check (auth.uid() = user_id);

-- Revision log policies
create policy "Users can view own revision logs" on revision_logs for select using (auth.uid() = user_id);
create policy "Users can insert own revision logs" on revision_logs for insert with check (auth.uid() = user_id);

-- Community policies
create policy "Anyone can view public communities" on communities for select using (is_private = false or exists (
  select 1 from community_members where community_id = communities.id and user_id = auth.uid()
));
create policy "Authenticated users can create communities" on communities for insert with check (auth.uid() = created_by);
create policy "Admins can update communities" on communities for update using (
  exists (select 1 from community_members where community_id = communities.id and user_id = auth.uid() and role = 'admin')
);

-- Community member policies
create policy "Members can view community members" on community_members for select using (
  exists (select 1 from community_members cm where cm.community_id = community_members.community_id and cm.user_id = auth.uid())
);
create policy "Users can join communities" on community_members for insert with check (auth.uid() = user_id);
create policy "Users can leave communities" on community_members for delete using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
