import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
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
