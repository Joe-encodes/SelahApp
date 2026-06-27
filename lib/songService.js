/**
 * Unified song service — reads from Supabase when online, falls back to IndexedDB.
 * All writes go to both so the library works offline.
 */

import { supabase } from "./supabase";
import {
  getAllSongs as idbGetAll,
  getSong as idbGetSong,
  saveSong as idbSaveSong,
  deleteSong as idbDeleteSong,
} from "./indexedDb";

const SUPABASE_READY =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export async function getSession() {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getUser() {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/app` },
  });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// ─── Song CRUD ────────────────────────────────────────────────────────────────

/**
 * Save a song locally and to Supabase if authenticated.
 * @param {Object} song
 * @returns {Object} saved song (with id from Supabase or local)
 */
export async function saveSong(song) {
  // Always cache locally first
  await idbSaveSong(song);

  if (!SUPABASE_READY) return song;

  const session = await getSession();
  if (!session) return song;

  // Prevent editing other users' songs on the database
  if (song.user_id && song.user_id !== session.user.id) {
    return song;
  }

  const res = await fetch("/api/song/save", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify(song),
  });

  if (res.ok) {
    const data = await res.json();
    const oldId = song.id;
    // Update local id to match supabase_id to prevent UI duplicates
    const merged = { ...song, id: String(data.id), supabase_id: data.id, user_id: data.user_id };
    
    // Delete the temporary timestamp-based local record if the ID changed
    if (String(oldId) !== String(data.id)) {
      await idbDeleteSong(oldId).catch(() => {});
    }
    
    await idbSaveSong(merged);
    return merged;
  }

  return song;
}

/**
 * Get all songs for the current user.
 * Falls back to IndexedDB when offline or unauthenticated.
 */
export async function getAllSongs() {
  if (!SUPABASE_READY) return idbGetAll();

  const user = await getUser();
  if (!user) return idbGetAll();

  try {
    const { data, error } = await supabase
      .from("songs")
      .select("*, song_likes(count), profiles(display_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const normalized = (data || []).map(normalizeSupabaseSong);
    // Warm the local cache
    for (const song of normalized) {
      await idbSaveSong(song).catch(() => {});
    }
    return normalized;
  } catch {
    return idbGetAll();
  }
}

let isSyncing = false;
export async function syncLocalSongsToCloud() {
  if (!SUPABASE_READY || isSyncing) return;
  isSyncing = true;
  try {
    const session = await getSession();
    if (!session) return;

    const localSongs = await idbGetAll();
    for (const song of localSongs) {
      if (!song.supabase_id) {
        const updated = { ...song, is_public: true, user_id: session.user.id };
        await saveSong(updated).catch(() => {});
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Get a single song by its local id.
 * Tries IndexedDB first (fast path), then Supabase.
 */
export async function getSong(localId) {
  const local = await idbGetSong(localId);
  if (local) return local;

  if (!SUPABASE_READY) return null;

  const { data } = await supabase
    .from("songs")
    .select("*, profiles(display_name)")
    .eq("id", localId)
    .single();

  return data ? normalizeSupabaseSong(data) : null;
}

export async function deleteSong(localId, supabaseId) {
  await idbDeleteSong(localId);
  if (supabaseId && SUPABASE_READY) {
    await supabase.from("songs").delete().eq("id", supabaseId);
  }
}

// ─── Community Feed ───────────────────────────────────────────────────────────

let cachedPublicSongs = null;
let lastPublicSongsFetch = 0;

export async function getPublicSongs(force = false) {
  if (!SUPABASE_READY) return [];
  if (!force && cachedPublicSongs && Date.now() - lastPublicSongsFetch < 60000) {
    return cachedPublicSongs;
  }
  const { data, error } = await supabase
    .from("songs")
    .select("*, song_likes(count), profiles(display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return cachedPublicSongs || [];
  cachedPublicSongs = (data || []).map(normalizeSupabaseSong);
  lastPublicSongsFetch = Date.now();
  return cachedPublicSongs;
}

export async function publishSong(supabaseId) {
  if (!SUPABASE_READY || !supabaseId) return;
  const user = await getUser();
  if (!user) return;
  await supabase
    .from("songs")
    .update({ is_public: true })
    .eq("id", supabaseId)
    .eq("user_id", user.id);
}

export async function unpublishSong(supabaseId) {
  if (!SUPABASE_READY || !supabaseId) return;
  const user = await getUser();
  if (!user) return;
  await supabase
    .from("songs")
    .update({ is_public: false })
    .eq("id", supabaseId)
    .eq("user_id", user.id);
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export async function getLikesForSong(supabaseId) {
  if (!SUPABASE_READY || !supabaseId) return { count: 0, userLiked: false };
  const user = await getUser();
  const { count } = await supabase
    .from("song_likes")
    .select("*", { count: "exact", head: true })
    .eq("song_id", supabaseId);

  let userLiked = false;
  if (user) {
    const { data } = await supabase
      .from("song_likes")
      .select("id")
      .eq("song_id", supabaseId)
      .eq("user_id", user.id)
      .single();
    userLiked = !!data;
  }
  return { count: count ?? 0, userLiked };
}

export async function toggleLike(supabaseId) {
  if (!SUPABASE_READY || !supabaseId) return false;
  const user = await getUser();
  if (!user) return false;

  const { data: existing } = await supabase
    .from("song_likes")
    .select("id")
    .eq("song_id", supabaseId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await supabase.from("song_likes").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("song_likes").insert({ song_id: supabaseId, user_id: user.id });
  return true;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  if (!SUPABASE_READY || !userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!error) return data;

  // Profile row missing — create it (mirrors what the old API route did)
  const user = await getUser();
  if (!user || user.id !== userId) return null;
  const fallbackName = user.email ? user.email.split("@")[0] : "Worshipper";
  const { data: created } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: fallbackName, credits: 3 }, { onConflict: "id" })
    .select()
    .single();
  return created ?? null;
}

export async function updateProfile(userId, displayName, avatarUrl) {
  if (!SUPABASE_READY || !userId) return null;
  const updateData = {};
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      throw new Error("Display name must be at least 2 characters.");
    }
    if (trimmed.length > 50) {
      throw new Error("Display name cannot exceed 50 characters.");
    }
    // Check if the display name is already taken by another user
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", trimmed)
      .neq("id", userId)
      .maybeSingle();

    if (existing) {
      throw new Error("Display name is already taken.");
    }
    updateData.display_name = trimmed;
  }
  if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error("Failed to update profile");
  return data;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function normalizeSupabaseSong(row) {
  return {
    id: String(row.id),
    supabase_id: row.id,
    user_id: row.user_id,
    title: row.title,
    genre: row.genre,
    musicKey: row.music_key,
    lang: row.lang,
    theme: row.theme,
    scripture: row.scripture,
    lyrics: row.lyrics ?? [],
    chords: row.chords ?? [],
    emotional_mode: row.emotional_mode,
    instrumentation: row.instrumentation,
    vocal_gender: row.vocal_gender,
    audio_url: row.audio_url,
    tracks: row.tracks,
    ai_source: row.ai_source,
    is_public: row.is_public ?? true,
    created_at: new Date(row.created_at).getTime(),
    like_count: row.song_likes?.[0]?.count ?? 0,
    creator_name: row.profiles?.display_name || null,
  };
}
