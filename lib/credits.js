import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getServiceClient = () => {
  if (supabaseUrl && supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
  );
};

export async function checkAndDeductCredit(userId, cost = 3) {
  const serviceClient = getServiceClient();

  const { data, error } = await serviceClient.rpc("deduct_credits", {
    p_user_id: userId,
    p_cost: cost,
  });

  if (error) {
    console.warn("[credits] Supabase RPC deduct_credits failed or is not deployed. Falling back to query validation.");
    try {
      const { data: profile, error: fetchError } = await serviceClient
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .single();
      
      if (fetchError || !profile) {
        return { allowed: false, reason: "Profile not found" };
      }

      if (profile.credits < cost) {
        return { allowed: false, reason: "Insufficient credits" };
      }

      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({ credits: profile.credits - cost })
        .eq("id", userId);

      if (updateError) {
        return { allowed: false, reason: "Failed to deduct credits" };
      }

      return { allowed: true, remaining: profile.credits - cost };
    } catch (e) {
      return { allowed: false, reason: e.message };
    }
  }

  if (data && typeof data === "object") {
    return {
      allowed: data.success ?? false,
      remaining: data.remaining ?? 0,
      reason: data.success ? null : "Insufficient credits",
    };
  }

  return { allowed: false, reason: "Invalid RPC response" };
}
