-- ============================================================
-- SelahApp — Supabase Database Schema (Master Migration Script)
-- Run this once in the Supabase SQL Editor for your project.
-- Go to: https://supabase.com → Your Project → SQL Editor → New Query
-- Note: This script is fully idempotent and safe to run multiple times.
-- It preserves all data while strictly enforcing the latest schema and relations.
-- ============================================================

-- 1. Clean up legacy or incorrect table schemas safely
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS public.comment_likes CASCADE;

-- 2. User profiles (Must be created first as other tables reference it)
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid REFERENCES auth.users PRIMARY KEY,
  display_name text,
  avatar_url  text,
  credits     int DEFAULT 3,
  credits_reset_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Ensure profiles columns compatibility if profiles existed early
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INT DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;

-- Ensure case-insensitive unique display names
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_display_name ON profiles (LOWER(display_name));

-- 3. Songs table
CREATE TABLE IF NOT EXISTS songs (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES public.profiles(id) NOT NULL,
  title           text NOT NULL,
  genre           text,
  music_key       text,
  lang            text,
  theme           text,
  scripture       text,
  lyrics          jsonb,
  chords          text[],
  emotional_mode  text,
  instrumentation text,
  vocal_gender    text,
  audio_url       text,
  tracks          jsonb,
  ai_source       text,
  is_public       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- 4. Song likes table
CREATE TABLE IF NOT EXISTS song_likes (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  song_id     bigint REFERENCES songs ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, song_id)
);

-- 5. Song comments table
CREATE TABLE IF NOT EXISTS song_comments (
  id          bigserial PRIMARY KEY,
  song_id     bigint REFERENCES songs ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 6. Comment reactions table (Tracks likes/hearts on comments)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id          bigserial PRIMARY KEY,
  comment_id  bigint REFERENCES song_comments ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- 7. Dynamically Fix Foreign Keys for Existing Databases
-- If the tables already existed, their user_id columns might still point to auth.users.
-- This block safely drops old foreign keys and recreates them to point to public.profiles.
DO $$
DECLARE
    row record;
BEGIN
    -- Drop any existing foreign key constraints on user_id for our tables
    FOR row IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name IN ('songs', 'song_likes', 'song_comments', 'comment_reactions')
          AND kcu.column_name = 'user_id'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(row.table_name) || ' DROP CONSTRAINT ' || quote_ident(row.constraint_name);
    END LOOP;
END;
$$;

-- Re-add the correct foreign keys to public.profiles
ALTER TABLE songs ADD CONSTRAINT songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE song_comments ADD CONSTRAINT song_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE song_likes ADD CONSTRAINT song_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- 9. Row Level Security Policies

-- Policies for profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

-- Policies for songs
DROP POLICY IF EXISTS "Users can manage their own songs" ON songs;
CREATE POLICY "Users can manage their own songs" ON songs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public songs are readable by anyone" ON songs;
CREATE POLICY "Public songs are readable by anyone" ON songs FOR SELECT USING (is_public = true);

-- Policies for song_likes
DROP POLICY IF EXISTS "Users manage their own likes" ON song_likes;
CREATE POLICY "Users manage their own likes" ON song_likes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can see likes" ON song_likes;
CREATE POLICY "Anyone can see likes" ON song_likes FOR SELECT USING (true);

-- Policies for song_comments
DROP POLICY IF EXISTS "Users can manage their own comments" ON song_comments;
CREATE POLICY "Users can manage their own comments" ON song_comments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can see comments" ON song_comments;
CREATE POLICY "Anyone can see comments" ON song_comments FOR SELECT USING (true);

-- Policies for comment_reactions
DROP POLICY IF EXISTS "Users manage their own comment reactions" ON comment_reactions;
CREATE POLICY "Users manage their own comment reactions" ON comment_reactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can see comment reactions" ON comment_reactions;
CREATE POLICY "Anyone can see comment reactions" ON comment_reactions FOR SELECT USING (true);


-- 10. Trigger for Auto-Creating Profiles on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_display_name text;
  v_base_name text;
  v_counter int := 1;
BEGIN
  v_base_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_display_name := v_base_name;
  
  -- Loop to find a unique display name if it already exists
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(display_name) = lower(v_display_name)) LOOP
    v_counter := v_counter + 1;
    v_display_name := v_base_name || v_counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, avatar_url, credits)
  VALUES (
    new.id,
    v_display_name,
    new.raw_user_meta_data->>'avatar_url',
    3
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 11. Thread-safe RPC to Deduct Credits
CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid, p_cost int)
RETURNS json AS $$
DECLARE
  v_credits int;
  v_success boolean := false;
BEGIN
  -- Lock the row for update to ensure serialized execution on this user profile row
  SELECT credits INTO v_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'remaining', 0, 'message', 'Profile not found');
  END IF;

  IF v_credits >= p_cost THEN
    UPDATE public.profiles
    SET credits = credits - p_cost
    WHERE id = p_user_id;

    v_success := true;
    v_credits := v_credits - p_cost;
  END IF;

  RETURN json_build_object('success', v_success, 'remaining', v_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Role Permission Grants
GRANT ALL PRIVILEGES ON TABLE songs TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE profiles TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE song_likes TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE song_comments TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE comment_reactions TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 13. Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);
CREATE INDEX IF NOT EXISTS idx_song_likes_song_id ON song_likes(song_id);
CREATE INDEX IF NOT EXISTS idx_song_comments_song_id ON song_comments(song_id);
