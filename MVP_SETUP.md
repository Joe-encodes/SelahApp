# MVP Setup & Database Migration Guide

This guide details the steps required to deploy the SelahAI MVP version and configure your database and environment settings correctly.

---

## 1. Supabase Database Schema Setup

You must configure the following tables and Row Level Security (RLS) policies in your Supabase SQL editor:

### Step 1: Base Application Tables
Run the contents of [schema.sql](lib/schema.sql) in your Supabase SQL Editor. This initializes:
- `songs` (For saving layouts, lyrics, chords, and playback links)
- `song_likes` (For liking explore arrangements)
- `profiles` (For managing display names and avatars)
- `handle_new_user` trigger (Automatically generates a profile whenever a new user signs up via auth)

### Step 2: Database Migration & Schema Upgrades
If you already set up the base tables and only have `songs`, `song_likes`, and base `profiles` (without credit fields, comments, or RPC functions), run the following query in your Supabase SQL Editor. This will safely migrate your schema:

```sql
-- 1. Upgrade profiles table to support credits system
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits INT DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;

-- 2. Recreate handle_new_user trigger function to populate initial credits (default: 3)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, credits)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    3
  );
  return new;
END;
$$ LANGUAGE plpgsql security definer;

-- 3. Create song comments table
CREATE TABLE IF NOT EXISTS song_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create comment reactions/likes table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES song_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 5. Enable Row Level Security (RLS) for new tables
ALTER TABLE song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- 6. Configure RLS Policies safely (using drop-before-create patterns)
DROP POLICY IF EXISTS "Anyone can read comments" ON song_comments;
CREATE POLICY "Anyone can read comments" ON song_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment" ON song_comments;
CREATE POLICY "Authenticated users can comment" ON song_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON song_comments;
CREATE POLICY "Users can delete own comments" ON song_comments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read comment reactions" ON comment_reactions;
CREATE POLICY "Anyone can read comment reactions" ON comment_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can toggle reaction" ON comment_reactions;
CREATE POLICY "Authenticated users can toggle reaction" ON comment_reactions FOR ALL USING (auth.uid() = user_id);

-- 7. Deploy thread-safe RPC function to check and deduct credits safely preventing concurrent race condition spends
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_cost int)
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

  IF v_credits >= p_cost then
    UPDATE public.profiles
    SET credits = credits - p_cost
    WHERE id = p_user_id;

    v_success := true;
    v_credits := v_credits - p_cost;
  END IF;

  RETURN json_build_object('success', v_success, 'remaining', v_credits);
END;
$$ LANGUAGE plpgsql security definer;
```

---

## 2. Environment Variables (`.env.local`)

Ensure your local configuration has the following credentials configured:

```ini
# Supabase Database Client Details
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key

# Groq Llama AI Keys (Supports rotation of up to 4 keys to prevent rate limits)
GROQ_API_KEY=your_primary_groq_key
GROQ_API_KEY_2=your_backup_groq_key_2
GROQ_API_KEY_3=your_backup_groq_key_3
GROQ_API_KEY_4=your_backup_groq_key_4

# Replicate API (Optional: Only required for Demucs high-quality stem splits. If omitted, splits fall back to MIDI + MP3)
REPLICATE_API_TOKEN=your_replicate_token_here
```

---

## 3. Running & Verifying Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Launch dev environment**:
   ```bash
   npm run dev
   ```
3. **Verify build for production**:
   ```bash
   npm run build
   ```
