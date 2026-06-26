import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { MOCK_SONGS } from "../data/constants";
import { GeneratingModal } from "../components/GeneratingModal";
import { AuthRequiredModal } from "../components/AuthRequiredModal";
import { HomeTab } from "../components/tabs/HomeTab";
import { CreateTab } from "../components/tabs/CreateTab";
import { RehearseTab } from "../components/tabs/RehearseTab";
import { LibraryTab } from "../components/tabs/LibraryTab";
import { CommunityTab } from "../components/tabs/CommunityTab";
import { useAudioContext } from "../lib/audioContext";
import { supabase } from "../lib/supabase";
import { getAllSongs, saveSong, getUser, signOut, getProfile, syncLocalSongsToCloud } from "../lib/songService";
import { ProfileModal } from "../components/ProfileModal";

const VALID_TABS = ["home", "create", "rehearse", "library", "community"];

export default function SelahApp() {
  const router = useRouter();
  const activeTab = VALID_TABS.includes(router.query.tab) ? router.query.tab : "home";

  const [songs, setSongs] = useState(MOCK_SONGS);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const { activeSong, setActiveSong, audioState, setPlayQueue, setPlaySource, handleNext, handlePrev } = useAudioContext();
  const [generating, setGenerating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [user, setUser] = useState(null);
  const [userInitials, setUserInitials] = useState("?");
  const [userInitialized, setUserInitialized] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(null);

  const { isPlaying, currentChordIdx, bpm, setBpm, play, pause, stop } = audioState;

  // Navigate to a tab via URL — back button works correctly
  const goToTab = useCallback((tabId) => {
    router.push(`/app?tab=${tabId}`, undefined, { shallow: true });
  }, [router]);

  // ─── Auth initialization ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email || "?";
        setUserInitials(name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2));
      }
      setUserInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserInitialized(true);
    });

    const checkOnlineStatus = async () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch("/logo.png", { method: "HEAD", signal: controller.signal });
        clearTimeout(timeoutId);
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };

    setIsOffline(!navigator.onLine);
    checkOnlineStatus();

    const handleOnline = () => checkOnlineStatus();
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      subscription.unsubscribe();
    };
  }, []);

  // Sync profile when user loaded
  useEffect(() => {
    if (user) {
      getProfile(user.id).then((p) => { if (p) setProfile(p); }).catch(console.error);
    } else {
      setProfile(null);
    }
  }, [user]);

  // Compute initials dynamically
  useEffect(() => {
    if (user) {
      const name = profile?.display_name || user.user_metadata?.full_name || user.email || "?";
      setUserInitials(name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2));
    }
  }, [user, profile]);

  // Songs loading & syncing
  useEffect(() => {
    if (!userInitialized) return;
    setSongsLoaded(false);

    const loadAndSync = async () => {
      if (user) {
        await syncLocalSongsToCloud().catch(console.error);
      }
      getAllSongs().then((dbSongs) => {
        if (dbSongs && dbSongs.length > 0) {
          setSongs((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const unique = dbSongs.filter((s) => !existingIds.has(s.id));
            return [...unique, ...prev];
          });
        } else if (dbSongs && dbSongs.length === 0) {
          setSongs([]);
        }
        setSongsLoaded(true);
      }).catch(() => setSongsLoaded(true));
    };

    loadAndSync();
  }, [user, userInitialized]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = async (params) => {
    if (isOffline) {
      alert("You are offline. Song generation requires an active internet connection.");
      return;
    }
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setGenerating(true);
    try {
      const creatorName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || null;

      if (params.isPreset) {
        // Prevent duplicate: if a song with this exact title already exists, navigate to it
        const existingPreset = songs.find(
          (s) => s.title === params.title && s.chords?.join(",") === (params.chords || []).join(",")
        );
        if (existingPreset) {
          stop();
          setActiveSong(existingPreset);
          router.push(`/song/${existingPreset.id}?from=${activeTab}`);
          setGenerating(false);
          return;
        }
        const newSong = {
          id: Date.now(),
          title: params.title,
          genre: params.genre || "Contemporary",
          musicKey: params.musicKey || "G",
          lang: "English",
          theme: params.theme || "",
          scripture: params.scripture || "",
          lyrics: params.lyrics || [],
          chords: params.chords || [],
          creator_name: creatorName,
          is_public: false,
          created_at: Date.now(),
        };
        const savedSong = await saveSong(newSong).catch(() => newSong);
        setSongs((prev) => [savedSong, ...prev]);
        stop();
        setActiveSong(savedSong);
        router.push(`/song/${savedSong.id}?from=${activeTab}`);
        return;
      }

      const { theme, musicKey, langs, genre: selectedGenre, harmony, scripture, rawSongText, emotional_mode, instrumentation, vocal_gender } = params;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, musicKey, langs, genre: selectedGenre, harmony, scripture, rawSongText, emotional_mode, instrumentation, vocal_gender }),
      });
      const data = await res.json();
      const newSong = {
        id: Date.now(),
        title: data.title || `New ${theme} Song`,
        genre: selectedGenre,
        musicKey,
        lang: langs ? langs.join(" + ") : "English",
        theme,
        scripture: data.scripture || scripture || `Auto-matched for "${theme}"`,
        lyrics: data.lyrics || [],
        chords: data.chords || [],
        emotional_mode: data.emotional_mode || emotional_mode || null,
        instrumentation: data.instrumentation || instrumentation || null,
        vocal_gender: data.vocal_gender || vocal_gender || null,
        creator_name: creatorName,
        is_public: true,
        created_at: Date.now(),
      };
      const savedSong = await saveSong(newSong).catch(() => newSong);
      setSongs((prev) => [savedSong, ...prev]);
      stop();
      setActiveSong(savedSong);
      router.push(`/song/${savedSong.id}?from=${activeTab}`);
    } catch (err) {
      console.error(err);
      alert("Error generating song. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateSong = useCallback(async (updatedSong) => {
    setSongs((prev) => prev.map((s) => (s.id === updatedSong.id ? updatedSong : s)));
    if (activeSong?.id === updatedSong.id) setActiveSong(updatedSong);
    await saveSong(updatedSong).catch(console.error);
  }, [activeSong]);

  const handleSongSelect = (song) => {
    stop();
    let sourceQueue = [];
    let sourceName = "";
    if (activeTab === "home") {
      sourceQueue = filteredSongs;
      sourceName = "Discover";
    } else if (activeTab === "library") {
      sourceQueue = songs.filter((s) => {
        if (s.created_at && (Date.now() - s.created_at) > 48 * 60 * 60 * 1000) return false;
        if (s.is_public) return true;
        if (user && String(s.user_id) === String(user.id)) return true;
        return false;
      });
      sourceName = "Library";
    } else if (activeTab === "rehearse") {
      sourceQueue = songs;
      sourceName = "Rehearsal Room";
    } else if (activeTab === "community") {
      sourceName = "Community Feed";
    }

    if (sourceQueue.length > 0) {
      setPlayQueue(sourceQueue);
    }
    if (sourceName) {
      setPlaySource(sourceName);
    }

    setActiveSong(song);
    router.push(`/song/${song.id}?from=${activeTab}`);
  };

  const handleQuickPlay = (song) => {
    let sourceQueue = [];
    let sourceName = "";
    if (activeTab === "home") {
      sourceQueue = filteredSongs;
      sourceName = "Discover";
    } else if (activeTab === "library") {
      sourceQueue = songs.filter((s) => {
        if (s.created_at && (Date.now() - s.created_at) > 48 * 60 * 60 * 1000) return false;
        if (s.is_public) return true;
        if (user && String(s.user_id) === String(user.id)) return true;
        return false;
      });
      sourceName = "Library";
    } else if (activeTab === "rehearse") {
      sourceQueue = songs;
      sourceName = "Rehearsal Room";
    } else if (activeTab === "community") {
      sourceName = "Community Feed";
    }

    if (sourceQueue.length > 0) {
      setPlayQueue(sourceQueue);
    }
    if (sourceName) {
      setPlaySource(sourceName);
    }

    if (activeSong?.id === song.id) {
      isPlaying ? pause() : play();
      return;
    }
    stop();
    setActiveSong(song);
    setTimeout(() => play(), 50);
  };

  const handleSignOut = async () => {
    stop();
    setActiveSong(null);
    await signOut();
    router.push("/auth");
  };

  // ─── Sidebar ───────────────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: "home", label: "Discover", icon: "explore" },
    { id: "create", label: "Create Studio", icon: "add_circle" },
    { id: "rehearse", label: "Rehearsal Room", icon: "school" },
    { id: "library", label: "Library", icon: "library_music" },
    { id: "community", label: "Community", icon: "groups" },
  ];

  const SidebarNav = () => (
    <aside className="fixed left-0 top-0 h-full w-64 bg-suno-gray-900 border-r border-suno-gray-800 flex flex-col p-6 z-50 hidden md:flex">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 border-b border-suno-gray-800 pb-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-suno-gray-900 border border-suno-gray-800 flex items-center justify-center shadow-lg mb-3">
          <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-center mt-2">
          <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-300 font-bold mt-1">Gospel Music App</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => goToTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium ${
              activeTab === id ? "bg-suno-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${activeTab === id ? "text-suno-accent" : ""}`}>{icon}</span>
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </nav>

      {/* User profile area */}
      <div className="border-t border-suno-gray-800 pt-4 mt-4">
        {user ? (
          <div
            onClick={() => setShowProfileModal(true)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-suno-gray-800/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-suno-accent/20 border border-suno-accent/30 flex items-center justify-center shrink-0">
              {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                <img src={profile?.avatar_url || user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-sm font-extrabold text-suno-accent">{userInitials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-white truncate group-hover:text-suno-accent transition-colors">
                {profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
              </p>
              <p className="text-xs text-gray-350 truncate font-bold">Settings</p>
            </div>
            <button
              id="sign-out-btn"
              onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-base">logout</span>
            </button>
          </div>
        ) : (
          <button
            id="sign-in-nav-btn"
            onClick={() => router.push("/auth")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-suno-gray-800/50 transition-all font-medium"
          >
            <span className="material-symbols-outlined text-xl">person</span>
            <span className="text-sm">Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );

  const filteredSongs = songs.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (s.title || "").toLowerCase().includes(q) ||
      (s.theme || "").toLowerCase().includes(q) ||
      (s.scripture || "").toLowerCase().includes(q) ||
      (s.genre || "").toLowerCase().includes(q)
    );
    const matchesGenre = selectedGenre ? (s.genre || "").toLowerCase() === selectedGenre.toLowerCase() : true;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="bg-suno-black text-white selection:bg-suno-accent/30 min-h-screen overflow-x-hidden font-sans">
      <Head>
        <title>SelahAI | Gospel Music Co-Writer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <GeneratingModal visible={generating} />
      <AuthRequiredModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <SidebarNav />

      <main className="md:ml-64 min-h-screen transition-all duration-300 flex flex-col justify-between">
        {/* Mobile header */}
        <header className="h-16 border-b border-suno-gray-800 flex items-center justify-between px-6 bg-suno-black/85 backdrop-blur-md sticky top-0 z-40 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-base text-white tracking-[0.15em] uppercase font-normal mt-0.5">Selah</h1>
          </div>
          <div className="flex items-center gap-2">
            {isOffline && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">Offline</span>
            )}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors active:scale-90"
              title="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
          </div>
        </header>

        {/* Desktop top bar — search (home only) + offline badge (all tabs) */}
        <header className="h-20 border-b border-suno-gray-800 flex items-center justify-between px-8 bg-suno-black/80 backdrop-blur-md sticky top-0 z-40 hidden md:flex">
          <div className="flex items-center gap-4">
            {activeTab === "home" ? (
              <div className="relative w-96">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-550">search</span>
                <input
                  className="selah-input !pl-12 pr-6 py-2 text-sm"
                  placeholder="Search songs, themes, scriptures..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            ) : (
              <h2 className="text-xs font-extrabold text-white uppercase tracking-widest">
                {NAV_ITEMS.find((item) => item.id === activeTab)?.label}
              </h2>
            )}
            {isOffline && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">Offline Mode</span>
            )}
          </div>
        </header>

        {/* Tab content */}
        <div className={`flex-1 px-4 md:px-8 pt-6 ${activeSong ? "pb-24" : "pb-12"}`}>
          {activeTab === "home" && (
            <HomeTab
              songs={filteredSongs}
              songsLoaded={songsLoaded}
              onPlay={handleSongSelect}
              onQuickPlay={handleQuickPlay}
              onCreateFirst={() => goToTab("create")}
              activeSongId={activeSong?.id}
              isPlaying={isPlaying}
              profile={profile}
              user={user}
              selectedGenre={selectedGenre}
              onSelectGenre={(g) => setSelectedGenre(prev => prev === g ? null : g)}
              isFiltered={!!searchQuery || !!selectedGenre}
            />
          )}
          {activeTab === "create" && <CreateTab onGenerate={handleGenerate} />}
          {activeTab === "rehearse" && <RehearseTab songs={songs} onPlay={handleSongSelect} onSelectClassic={handleGenerate} />}
          {activeTab === "library" && (
            <LibraryTab
              songs={songs}
              songsLoaded={songsLoaded}
              onPlay={handleSongSelect}
              onQuickPlay={handleQuickPlay}
              activeSongId={activeSong?.id}
              isPlaying={isPlaying}
              user={user}
              profile={profile}
            />
          )}
          {activeTab === "community" && <CommunityTab onPlay={handleSongSelect} />}
        </div>

        {/* Footer */}
        {activeTab === "home" && (
          <footer className={`mt-20 border-t border-suno-gray-800 px-8 pt-10 ${activeSong ? "pb-32" : "pb-12"} md:ml-0 animate-fadeIn`}>
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2 md:col-span-1">
                <h2 className="font-serif text-xl text-white tracking-[0.2em] uppercase font-medium mb-2">Selah</h2>
                <p className="text-xs text-gray-500 leading-relaxed">AI-powered gospel music co-writer for choirs, worship leaders, and composers.</p>
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-gray-300 uppercase tracking-widest mb-3">Explore</h3>
                <ul className="space-y-2">
                  {NAV_ITEMS.slice(0, 2).map(({ id, label }) => (
                    <li key={id}>
                      <button onClick={() => goToTab(id)} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">{label}</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-gray-300 uppercase tracking-widest mb-3">Rehearse</h3>
                <ul className="space-y-2">
                  {NAV_ITEMS.slice(2, 4).map(({ id, label }) => (
                    <li key={id}>
                      <button onClick={() => goToTab(id)} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">{label}</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-gray-300 uppercase tracking-widest mb-3">Legal</h3>
                <ul className="space-y-2 text-xs text-gray-500">
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/tos" className="hover:text-white transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-gray-700">© {new Date().getFullYear()} Selah. All rights reserved.</p>
          </footer>
        )}
      </main>

      {/* Persistent bottom player bar */}
      {activeSong && (
        <footer
          className="fixed bottom-0 left-0 w-full md:left-64 md:w-[calc(100%-16rem)] bg-suno-gray-900 border-t border-suno-gray-800 z-[60] flex items-center px-4 md:px-8 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] justify-between"
          style={{ height: "5rem", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div
            className="flex items-center gap-3 w-1/3 md:w-1/4 min-w-0 cursor-pointer group"
            onClick={() => router.push(`/song/${activeSong.id}?from=${activeTab}`)}
          >
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-suno-gray-800 overflow-hidden flex-shrink-0 shadow-lg border border-suno-gray-700 relative">
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">open_in_full</span>
              </div>
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <div className="truncate min-w-0">
              <h5 className="text-sm font-bold text-white truncate leading-tight group-hover:text-suno-accent transition-colors">{activeSong.title}</h5>
              <p className="text-xs text-gray-400 truncate leading-tight">{activeSong.genre} · Key of {activeSong.musicKey || activeSong?.chords?.[0]}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center min-w-0 px-3 md:px-4">
            <div className="flex items-center gap-4">
              <button onClick={handlePrev} className="text-gray-400 hover:text-white transition-colors cursor-pointer" title="Previous Song">
                <span className="material-symbols-outlined text-xl">skip_previous</span>
              </button>
              <button
                id="mini-player-play-btn"
                onClick={() => (isPlaying ? pause() : play())}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>
              <button onClick={handleNext} className="text-gray-400 hover:text-white transition-colors cursor-pointer" title="Next Song">
                <span className="material-symbols-outlined text-xl">skip_next</span>
              </button>
            </div>
          </div>

          <button
            id="open-choir-desk-btn"
            onClick={() => router.push(`/song/${activeSong.id}?from=${activeTab}`)}
            className="px-4 py-2 bg-suno-accent/10 hover:bg-suno-accent/20 text-suno-accent text-xs font-bold rounded-full border border-suno-accent/20 flex items-center gap-1.5 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">equalizer</span>
            <span className="hidden sm:inline">Choir Desk</span>
          </button>
        </footer>
      )}

      {/* Mobile bottom nav — always above mini player */}
      <nav className={`md:hidden fixed ${activeSong ? "bottom-20" : "bottom-0"} left-0 w-full bg-suno-gray-900 border-t border-suno-gray-800 flex justify-around items-center h-16 px-4 pb-safe z-[55] transition-all duration-300`}>
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`mobile-nav-${id}`}
            onClick={() => goToTab(id)}
            className={`flex flex-col items-center active:scale-90 transition-transform ${activeTab === id ? "text-suno-accent" : "text-gray-400"}`}
          >
            <span className="material-symbols-outlined text-xl">{icon}</span>
            <span className="text-xs font-bold mt-0.5">{label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile hamburger menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-suno-black/95 backdrop-blur-2xl z-[150] flex flex-col items-center justify-center space-y-8 animate-fadeIn">
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-6 right-6 p-2.5 text-gray-400 hover:text-white transition-colors"
            title="Close Menu"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-suno-gray-950 border border-suno-gray-800 shadow-lg mb-3">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
          </div>
          <nav className="flex flex-col items-center space-y-6">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { goToTab(id); setMenuOpen(false); }}
                className={`text-xl font-medium transition-colors ${activeTab === id ? "text-suno-accent" : "text-gray-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {user ? (
            <button
              onClick={() => { handleSignOut(); setMenuOpen(false); }}
              className="text-base text-gray-500 hover:text-red-400 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => { router.push("/auth"); setMenuOpen(false); }}
              className="text-base text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      )}

      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        profile={profile}
        onUpdateProfileState={(updated) => setProfile(updated)}
      />
    </div>
  );
}
