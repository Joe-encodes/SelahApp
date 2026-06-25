import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";
import { AudioProvider } from "../lib/audioContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state changes and redirect accordingly
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && router.pathname !== "/auth") {
        router.push("/auth");
      }
      if (event === "SIGNED_IN" && router.pathname === "/auth") {
        let dest = "/";
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
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <AudioProvider>
      <Component {...pageProps} />
    </AudioProvider>
  );
}
