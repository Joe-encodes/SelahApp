import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { z } from "zod";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
// We need an authenticated session to test RLS insertion, or use service_role to check constraints.
// Since we don't have service_role, we will test the Zod schema first.

const SaveSongSchema = z.object({
  id: z.any().optional(),
  supabase_id: z.any().optional(),
  title: z.string(),
  genre: z.string().optional().nullable(),
  musicKey: z.string().optional().nullable(),
  lang: z.string().optional().nullable(),
  theme: z.string().optional().nullable(),
  scripture: z.string().optional().nullable(),
  lyrics: z.any().optional().nullable(),
  chords: z.array(z.string()).optional().nullable(),
  emotional_mode: z.string().optional().nullable(),
  instrumentation: z.string().optional().nullable(),
  vocal_gender: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
  tracks: z.any().optional().nullable(),
  ai_source: z.string().optional().nullable(),
  is_public: z.boolean().optional().nullable(),
});

function testZod() {
  const params = {
    title: "Amazing Grace",
    genre: "Hymn",
    musicKey: "G",
    theme: "Grace",
    scripture: "",
    lyrics: [
      { part: "Verse 1", line: "Amazing grace! How sweet the sound", chords: ["G", "C", "G"], arrangement: [] }
    ],
    chords: ["G", "C"],
  };

  const newSong = {
    id: Date.now(),
    title: params.title,
    genre: params.genre || "Contemporary",
    musicKey: params.musicKey || "G",
    lang: "English",
    theme: params.theme || "",
    scripture: params.scripture || "",
    lyrics: params.lyrics || [],
    chords: params.chords || [],
    creator_name: "Test",
    is_public: false,
    created_at: Date.now(),
  };

  const validation = SaveSongSchema.safeParse(newSong);
  if (!validation.success) {
    console.error("Zod Validation Failed:", validation.error.format());
  } else {
    console.log("Zod Validation Passed!", validation.data);
  }
}

testZod();
