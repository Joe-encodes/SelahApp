import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (authMode === "signup") {
        let signUpError;
        let data;
        try {
          const res = await supabase.auth.signUp({ email, password });
          data = res.data;
          signUpError = res.error;
        } catch (e) {
          signUpError = e;
        }

        if (signUpError) {
          const isAlreadyRegistered = signUpError.message?.toLowerCase().includes("already registered") || 
                                     signUpError.message?.toLowerCase().includes("already exists");
          if (isAlreadyRegistered) {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
            let dest = "/app";
            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              const nextParam = params.get("next");
              if (nextParam) {
                const { isSafeRedirect } = require("../lib/security");
                if (isSafeRedirect(nextParam)) {
                  dest = nextParam;
                }
              }
            }
            router.push(dest);
            return;
          } else {
            throw signUpError;
          }
        }

        if (data?.session) {
          router.push("/app");
        } else {
          setSuccessMessage("Account created successfully! You can now sign in.");
          setAuthMode("signin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        let dest = "/app";
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const nextParam = params.get("next");
          if (nextParam) {
            const { isSafeRedirect } = require("../lib/security");
            if (isSafeRedirect(nextParam)) {
              dest = nextParam;
            }
          }
        }
        router.push(dest);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      let dest = "/app";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const nextParam = params.get("next");
        if (nextParam) {
          const { isSafeRedirect } = require("../lib/security");
          if (isSafeRedirect(nextParam)) {
            dest = nextParam;
          }
        }
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${dest}` },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-suno-black flex items-center justify-center p-4 font-sans">
      <Head>
        <title>Selah — Sign In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-suno-gray-900 border border-suno-gray-800 flex items-center justify-center shadow-xl mb-4">
            <img src="/logo.png" alt="Selah" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-serif text-3xl text-white tracking-[0.2em] uppercase">Selah</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Gospel Music Platform</p>
        </div>

        {/* Card */}
        <div className="selah-panel p-8">

          {/* Mode toggle */}
          <div className="flex bg-suno-gray-950 rounded-2xl p-1 mb-7 border border-suno-gray-800">
            <button
              id="auth-toggle-signin"
              onClick={() => { setAuthMode("signin"); setError(""); setSuccessMessage(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                authMode === "signin"
                  ? "bg-suno-accent text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-toggle-signup"
              onClick={() => { setAuthMode("signup"); setError(""); setSuccessMessage(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                authMode === "signup"
                  ? "bg-suno-accent text-white shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Google Sign-In */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm transition-all active:scale-95 mb-5 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
          >
            {googleLoading ? (
              <span className="animate-spin material-symbols-outlined text-gray-700 text-lg">progress_activity</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-suno-gray-800" />
            <span className="text-xs text-gray-600 uppercase tracking-widest font-bold">or</span>
            <div className="flex-1 h-px bg-suno-gray-800" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                id="auth-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="selah-input px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                id="auth-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                minLength={6}
                className="selah-input px-4 py-3 text-sm"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">check_circle</span>
                {successMessage}
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading || googleLoading}
              className="selah-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                  {authMode === "signup" ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                authMode === "signup" ? "Create Account" : "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6 leading-relaxed">
          By continuing, you agree to use this app for church and ministry purposes.
        </p>
      </div>
    </div>
  );
}
