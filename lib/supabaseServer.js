import { createClient } from "@supabase/supabase-js";

/**
 * Parses the Supabase session access token out of the request cookie header.
 * Supabase auth-helpers store the JWT in a cookie named:
 *   sb-{project-ref}-auth-token
 * and may split it into chunks (.0, .1, etc.) for large tokens.
 */
function extractAccessToken(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) return;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    cookies[key] = val;
  });

  // Collect all chunks matching sb-*-auth-token or sb-*-auth-token.N
  const chunkEntries = Object.entries(cookies)
    .filter(([k]) => /^sb-.+-auth-token(\.\d+)?$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b));

  if (chunkEntries.length === 0) return null;

  const combined = chunkEntries.map(([, v]) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }).join("");

  try {
    const parsed = JSON.parse(combined);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Creates a server-side Supabase client for use inside Next.js API routes
 * (Pages Router). It reads the Supabase auth token from cookies and injects
 * it as an Authorization header so that RLS policies resolve to the correct
 * user. Use `supabase.auth.getUser()` to verify the session in each handler.
 *
 * Drop-in replacement for `createPagesServerClient` from
 * @supabase/auth-helpers-nextjs which fails under Turbopack.
 *
 * @param {{ req: import('http').IncomingMessage }} options
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServerSupabaseClient({ req }) {
  let accessToken = null;

  // 1. Try to read from explicit Authorization header (e.g. "Bearer <token>")
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    accessToken = authHeader.split(" ")[1];
  } else {
    // 2. Fallback to cookies (auth-helpers standard)
    accessToken = extractAccessToken(req.headers?.cookie ?? "");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : {},
    }
  );
}
