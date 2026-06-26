-- ============================================================
-- SelahApp — Supabase Database Schema
-- Run this once in the Supabase SQL Editor for your project.
-- Go to: https://supabase.com → Your Project → SQL Editor → New Query
-- ============================================================

-- 1. Clean up legacy or incorrect table schemas safely
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS public.comment_likes CASCADE;

-- 2. Songs table
CREATE TABLE IF NOT EXISTS songs (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES auth.users NOT NULL,
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

-- 3. Song likes table
CREATE TABLE IF NOT EXISTS song_likes (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  song_id     bigint REFERENCES songs ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, song_id)
);

-- 4. User profiles
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

-- 5. Song comments table
CREATE TABLE IF NOT EXISTS song_comments (
  id          bigserial PRIMARY KEY,
  song_id     bigint REFERENCES songs ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 6. Comment reactions table (Tracks likes/hearts on comments)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id          bigserial PRIMARY KEY,
  comment_id  bigint REFERENCES song_comments ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- 8. Row Level Security Policies
-- Policies for songs
DROP POLICY IF EXISTS "Users can manage their own songs" ON songs;
DROP POLICY IF EXISTS "Users can manage their own songs" ON public.songs;
CREATE POLICY "Users can manage their own songs" ON songs
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public songs are readable by anyone" ON songs;
DROP POLICY IF EXISTS "Public songs are readable by anyone" ON public.songs;
CREATE POLICY "Public songs are readable by anyone" ON songs
  FOR SELECT USING (is_public = true);

-- Policies for song_likes
DROP POLICY IF EXISTS "Users manage their own likes" ON song_likes;
DROP POLICY IF EXISTS "Users manage their own likes" ON public.song_likes;
CREATE POLICY "Users manage their own likes" ON song_likes
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Like counts are readable by anyone" ON song_likes;
DROP POLICY IF EXISTS "Like counts are readable by anyone" ON public.song_likes;
CREATE POLICY "Like counts are readable by anyone" ON song_likes
  FOR SELECT USING (true);

-- Policies for profiles
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
CREATE POLICY "Users can read all profiles" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies for song_comments
DROP POLICY IF EXISTS "Anyone can read comments" ON song_comments;
DROP POLICY IF EXISTS "Anyone can read comments" ON public.song_comments;
CREATE POLICY "Anyone can read comments" ON song_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post comments" ON song_comments;
DROP POLICY IF EXISTS "Authenticated users can post comments" ON public.song_comments;
CREATE POLICY "Authenticated users can post comments" ON song_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own comments" ON song_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.song_comments;
CREATE POLICY "Users can delete their own comments" ON song_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for comment_reactions
DROP POLICY IF EXISTS "Anyone can see reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Anyone can see reactions" ON public.comment_reactions;
CREATE POLICY "Anyone can see reactions" ON comment_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can react" ON comment_reactions;
DROP POLICY IF EXISTS "Authenticated users can react" ON public.comment_reactions;
CREATE POLICY "Authenticated users can react" ON comment_reactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can toggle their own reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Users can toggle their own reactions" ON public.comment_reactions;
CREATE POLICY "Users can toggle their own reactions" ON comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- 9. Trigger for Auto-Creating Profiles on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, credits)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
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

-- 10. Thread-safe RPC to Deduct Credits
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

-- 11. Role Permission Grants
GRANT ALL PRIVILEGES ON TABLE song_comments TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE comment_reactions TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
