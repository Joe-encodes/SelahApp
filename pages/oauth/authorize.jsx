import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabase";

export default function AuthorizePage() {
  const router = useRouter();
  const { authorization_id } = router.query;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState(null);
  const [scopes, setScopes] = useState([]);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;

    if (!authorization_id) {
      setError("Invalid request: Missing authorization_id.");
      setLoading(false);
      return;
    }

    // Verify authentication first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Redirect to auth page and pass the current URL as a query param so we return here after login
        const returnUrl = encodeURIComponent(router.asPath);
        router.push(`/auth?next=${returnUrl}`);
        return;
      }

      setUser(session.user);
      fetchAuthorizationDetails();
    });
  }, [router.isReady, authorization_id]);

  const fetchAuthorizationDetails = async () => {
    try {
      setError("");
      // Call Supabase API to get details
      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorization_id);
      
      if (detailsError) {
        throw detailsError;
      }

      // Check if already consented
      if (data?.redirect_to) {
        window.location.href = data.redirect_to;
        return;
      }

      setClientInfo(data?.client);
      setScopes(data?.scopes || []);
    } catch (err) {
      console.error("Error fetching authorization details:", err);
      setError(err.message || "Failed to load authorization request details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setError("");
    try {
      const { data, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorization_id);
      if (approveError) throw approveError;
      
      if (data?.redirect_to) {
        window.location.href = data.redirect_to;
      }
    } catch (err) {
      console.error("Error approving authorization:", err);
      setError(err.message || "Could not complete the authorization approval.");
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    setActionLoading(true);
    setError("");
    try {
      const { data, error: denyError } = await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (denyError) throw denyError;
      
      if (data?.redirect_to) {
        window.location.href = data.redirect_to;
      }
    } catch (err) {
      console.error("Error denying authorization:", err);
      setError(err.message || "Could not complete the authorization rejection.");
      setActionLoading(false);
    }
  };

  // Human-readable scope mapper
  const formatScope = (scope) => {
    switch (scope) {
      case "openid":
        return "Access your unique user identifier";
      case "email":
        return "Access your primary email address";
      case "profile":
        return "Access your public profile, display name, and avatar image";
      case "songs":
        return "Read, write, edit, and export your gospel song arrangements";
      default:
        return `Requested permission: ${scope}`;
    }
  };

  return (
    <div className="min-h-screen bg-suno-black text-white flex items-center justify-center p-4 font-sans selection:bg-suno-accent/30">
      <Head>
        <title>Selah — Authorize Application</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="w-full max-w-lg">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-suno-gray-900 border border-suno-gray-800 flex items-center justify-center shadow-xl mb-3">
            <img src="/logo.png" alt="Selah" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-serif text-2xl text-white tracking-[0.2em] uppercase">Selah Connect</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">OAuth 2.1 Identity Service</p>
        </div>

        {/* Card */}
        <div className="bg-suno-gray-900 border border-suno-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-24 -top-24 w-48 h-48 bg-suno-accent/5 blur-3xl rounded-full"></div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <span className="animate-spin material-symbols-outlined text-4xl text-suno-accent">progress_activity</span>
              <p className="text-sm text-gray-400">Fetching authorization details...</p>
            </div>
          ) : error ? (
            <div className="space-y-6 text-center">
              <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white font-display">Authorization Request Failed</h2>
                <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">{error}</p>
              </div>
              <button
                onClick={() => router.push("/app")}
                className="px-6 py-2.5 rounded-2xl bg-suno-gray-800 hover:bg-suno-gray-750 text-white font-bold text-xs transition-all active:scale-95 border border-suno-gray-700"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header explanation */}
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-white font-display">
                  Authorize &ldquo;{clientInfo?.name || "Third-Party App"}&rdquo;?
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This application is requesting authorization to connect to your Selah account. It will have access to the items checked below.
                </p>
              </div>

              {/* Scopes container */}
              <div className="bg-suno-gray-950/50 border border-suno-gray-850/60 rounded-2xl p-5 space-y-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Requested Permissions</h3>
                <ul className="space-y-3.5">
                  {scopes.map((scope, idx) => (
                    <li key={idx} className="flex gap-3 items-start text-xs text-gray-300">
                      <span className="material-symbols-outlined text-suno-accent text-sm mt-0.5 shrink-0">check_circle</span>
                      <span className="leading-relaxed">{formatScope(scope)}</span>
                    </li>
                  ))}
                  {scopes.length === 0 && (
                    <li className="flex gap-3 items-start text-xs text-gray-400 italic">
                      <span className="material-symbols-outlined text-gray-600 text-sm mt-0.5 shrink-0">info</span>
                      <span className="leading-relaxed">No special permissions requested.</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* User authentication account footer */}
              {user && (
                <div className="flex items-center justify-between px-3 py-2 bg-suno-gray-950/20 border border-suno-gray-850/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-500 text-sm">account_circle</span>
                    <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                      Signed in as <span className="text-gray-300 font-bold">{user.email}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/auth?next=${encodeURIComponent(router.asPath)}`)}
                    className="text-[10px] text-suno-accent hover:underline font-bold"
                  >
                    Switch Account
                  </button>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  id="oauth-deny-btn"
                  onClick={handleDeny}
                  disabled={actionLoading}
                  className="flex-1 py-3.5 rounded-2xl bg-suno-gray-800 hover:bg-suno-gray-750 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed border border-suno-gray-700"
                >
                  {actionLoading ? "Processing..." : "Cancel & Deny"}
                </button>
                <button
                  id="oauth-approve-btn"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 py-3.5 rounded-2xl bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                >
                  {actionLoading ? "Processing..." : "Approve & Connect"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-6 leading-relaxed max-w-sm mx-auto">
          Ensure you trust &ldquo;{clientInfo?.name || "this application"}&rdquo; before granting access. You can manage or revoke active applications in your account settings.
        </p>
      </div>
    </div>
  );
}
