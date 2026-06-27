import { createServerSupabaseClient } from "../../lib/supabaseServer";

export default async function handler(req, res) {
  const supabase = createServerSupabaseClient({ req });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to run the DB test." });
  }

  const results = {
    user: user.id,
    steps: []
  };

  try {
    // 1. Insert a test song
    const { data: song, error: insertError } = await supabase.from("songs").insert({
      user_id: user.id,
      title: "DB Diagnostics Test Song",
      is_public: false
    }).select().single();

    if (insertError) {
      results.steps.push({ step: "Insert Song", status: "FAILED", error: insertError });
      return res.status(500).json(results);
    }
    results.steps.push({ step: "Insert Song", status: "PASSED", data: song.id });

    // 2. Update the song
    const { error: updateError } = await supabase.from("songs").update({ title: "Updated Test Song" }).eq("id", song.id);
    if (updateError) {
      results.steps.push({ step: "Update Song", status: "FAILED", error: updateError });
    } else {
      results.steps.push({ step: "Update Song", status: "PASSED" });
    }

    // 3. Like the song
    const { error: likeError } = await supabase.from("song_likes").insert({
      user_id: user.id,
      song_id: song.id
    });
    if (likeError) {
      results.steps.push({ step: "Like Song", status: "FAILED", error: likeError });
    } else {
      results.steps.push({ step: "Like Song", status: "PASSED" });
    }

    // 4. Comment on the song
    const { error: commentError } = await supabase.from("song_comments").insert({
      user_id: user.id,
      song_id: song.id,
      content: "Test comment"
    });
    if (commentError) {
      results.steps.push({ step: "Comment on Song", status: "FAILED", error: commentError });
    } else {
      results.steps.push({ step: "Comment on Song", status: "PASSED" });
    }

    // 5. Clean up
    const { error: deleteError } = await supabase.from("songs").delete().eq("id", song.id);
    if (deleteError) {
      results.steps.push({ step: "Delete Song", status: "FAILED", error: deleteError });
    } else {
      results.steps.push({ step: "Delete Song", status: "PASSED" });
    }

  } catch (err) {
    results.steps.push({ step: "Fatal", status: "ERROR", error: err.message });
  }

  res.status(200).json(results);
}
