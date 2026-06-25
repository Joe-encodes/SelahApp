import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

const SaveSongSchema = z.object({
  id: z.any().optional(),
  supabase_id: z.any().optional(),
  title: z.string(),
  genre: z.string().optional().nullable(),
  musicKey: z.string().optional().nullable(),
  lang: z.string().optional().nullable(),
  theme: z.string().optional().nullable(),
  scripture: z.string().optional().nullable(),
  lyrics: z.array(z.any()).optional().nullable(),
  chords: z.array(z.string()).optional().nullable(),
  emotional_mode: z.string().optional().nullable(),
  instrumentation: z.string().optional().nullable(),
  vocal_gender: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
  tracks: z.array(z.any()).optional().nullable(),
  ai_source: z.string().optional().nullable(),
  is_public: z.boolean().optional().nullable(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to continue." });
  }

  const user = session.user;

  const validation = SaveSongSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(422).json({
      error: "validation_failed",
      message: "Some fields are invalid.",
      details: validation.error.format(),
    });
  }

  const song = validation.data;

  const payload = {
    user_id: user.id,
    title: song.title,
    genre: song.genre,
    music_key: song.musicKey,
    lang: song.lang,
    theme: song.theme,
    scripture: song.scripture,
    lyrics: song.lyrics,
    chords: song.chords,
    emotional_mode: song.emotional_mode,
    instrumentation: song.instrumentation,
    vocal_gender: song.vocal_gender,
    audio_url: song.audio_url || null,
    tracks: song.tracks || null,
    ai_source: song.ai_source || null,
    is_public: song.is_public ?? true,
  };

  try {
    if (song.supabase_id) {
      // Update song directly checking ownership in a single query
      const { data, error } = await supabase
        .from("songs")
        .update(payload)
        .eq("id", song.supabase_id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "not_found", message: "Song not found or unauthorized." });
        }
        throw error;
      }
      return res.status(200).json(data);
    } else {
      // Insert new song
      const { data, error } = await supabase.from("songs").insert(payload).select().single();

      if (error) throw error;
      return res.status(200).json(data);
    }
  } catch (err) {
    console.error("[save] Save song error:", err?.message || err);
    return res.status(500).json({ error: "server_error", message: "Unexpected server error." });
  }
}
