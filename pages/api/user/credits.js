import { createServerSupabaseClient } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = createServerSupabaseClient({ req });
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to continue." });
  }

  const user = sessionUser;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("credits, credits_reset_at")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      // Fallback default credits
      return res.status(200).json({ credits: 3, credits_reset_at: null });
    }

    return res.status(200).json({
      credits: data.credits ?? 3,
      credits_reset_at: data.credits_reset_at || null,
    });
  } catch (err) {
    console.error("[credits] Credits fetch error:", err?.message || err);
    return res.status(500).json({ error: "server_error", message: "Unexpected server error." });
  }
}
