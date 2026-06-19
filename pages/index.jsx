import { useState, useEffect } from "react";
import Head from "next/head";
import { C, MOCK_SONGS } from "../data/constants";
import { GeneratingModal } from "../components/GeneratingModal";
import { Player } from "../components/Player";
import { HomeTab } from "../components/tabs/HomeTab";
import { CreateTab } from "../components/tabs/CreateTab";
import { LibraryTab } from "../components/tabs/LibraryTab";
import { useGospelAudio } from "../lib/useGospelAudio";

export default function SelahApp() {
  const [tab, setTab] = useState("home");
  const [songs, setSongs] = useState(MOCK_SONGS);
  const [activeSong, setActiveSong] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const chords = activeSong?.chords && activeSong.chords.length > 0 ? activeSong.chords : ["C", "F", "G", "Am"];
  const genre = activeSong?.genre || "Contemporary";

  // Persistent audio state managed at layout level
  const audioState = useGospelAudio(chords, genre);
  const { isPlaying, currentChordIdx, bpm, setBpm, play, pause, stop } = audioState;

  // Auto-play new songs when generated
  const handleGenerate = async ({ theme, musicKey, langs, genre: selectedGenre, harmony, scripture }) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, musicKey, langs, genre: selectedGenre, harmony, scripture }),
      });
      
      const data = await res.json();
      
      const newSong = {
        id: Date.now(),
        title: data.title || `New ${theme} Song`,
        genre: selectedGenre,
        musicKey,
        lang: langs.join(" + "),
        theme,
        scripture: data.scripture || scripture || `Auto-matched for "${theme}"`,
        lyrics: data.lyrics || [],
        chords: data.chords || []
      };
      
      setSongs((prev) => [newSong, ...prev]);
      stop();
      setActiveSong(newSong);
      // Wait a moment for state to update, then play
      setTimeout(() => {
        setIsPlayerExpanded(true);
      }, 300);
    } catch (err) {
      console.error(err);
      alert("Error generating song. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSongSelect = (song) => {
    stop();
    setActiveSong(song);
    // Auto-open expanded view for focus rehearsal
    setIsPlayerExpanded(true);
  };

  return (
    <div className="bg-suno-black text-white selection:bg-suno-accent/30 min-h-screen overflow-x-hidden font-sans">
      <Head>
        <title>SelahAI | Gospel Music Co-Writer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </Head>

      <GeneratingModal visible={generating} />

      {/* Sidebar Navigation Shell (Hidden on Mobile) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-suno-gray-900 border-r border-suno-gray-800 flex flex-col p-6 space-y-4 z-50 hidden md:flex">
        <div className="flex flex-col items-center mb-8 border-b border-suno-gray-800 pb-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-suno-gray-900 border border-suno-gray-800 flex items-center justify-center shadow-lg mb-3">
            <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-center mt-2">
            <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold mt-1">Gospel Music App</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setTab("home")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium ${
              tab === "home" ? "bg-suno-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${tab === "home" ? "text-suno-accent" : ""}`}>explore</span>
            <span className="text-sm">Discover</span>
          </button>
          <button
            onClick={() => setTab("create")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium ${
              tab === "create" ? "bg-suno-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${tab === "create" ? "text-suno-accent" : ""}`}>add_circle</span>
            <span className="text-sm">Create Studio</span>
          </button>
          <button
            onClick={() => setTab("library")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium ${
              tab === "library" ? "bg-suno-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${tab === "library" ? "text-suno-accent" : ""}`}>library_music</span>
            <span className="text-sm">Library</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={`md:ml-64 ${activeSong ? "pb-44" : "pb-24"} min-h-screen transition-all duration-300`}>
        {/* Mobile Top Navbar */}
        <header className="h-16 border-b border-suno-gray-800 flex items-center justify-between px-6 bg-suno-black/85 backdrop-blur-md sticky top-0 z-40 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-base text-white tracking-[0.15em] uppercase font-normal mt-0.5">Selah</h1>
          </div>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors active:scale-90"
            title="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        </header>

        {/* Top Header Anchor */}
        <header className="h-20 border-b border-suno-gray-800 flex items-center justify-between px-8 bg-suno-black/80 backdrop-blur-md sticky top-0 z-40 hidden md:flex">
          <div className="flex items-center gap-6">
            <div className="relative w-96">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">search</span>
              <input
                className="w-full bg-suno-gray-900 border border-suno-gray-800 rounded-full pl-12 pr-6 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-suno-accent focus:border-suno-accent text-white placeholder:text-gray-500 transition-all"
                placeholder="Search for songs, themes, scriptures..."
                type="text"
                disabled
              />
            </div>
          </div>
          <div className="flex items-center gap-6 text-gray-400">
          </div>
        </header>

        {/* Dynamic Tab Render */}
        <div className="px-4 md:px-8 pt-6">
          {tab === "home" && <HomeTab songs={songs} onPlay={handleSongSelect} />}
          {tab === "create" && <CreateTab onGenerate={handleGenerate} />}
          {tab === "library" && <LibraryTab songs={songs} onPlay={handleSongSelect} />}
        </div>
      </main>

      {/* Persistent Player Bar */}
      {activeSong && (
        <footer className="fixed bottom-0 left-0 w-full bg-suno-gray-900 border-t border-suno-gray-800 h-24 z-[60] flex items-center px-4 md:px-8 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] justify-between">
          <div className="flex items-center gap-4 w-1/3 md:w-1/4">
            <div 
              onClick={() => setIsPlayerExpanded(true)}
              className="w-14 h-14 rounded-lg bg-suno-gray-800 overflow-hidden flex-shrink-0 shadow-lg border border-suno-gray-700 cursor-pointer group relative"
            >
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">open_in_full</span>
              </div>
              <div className="w-full h-full bg-suno-gray-900 flex items-center justify-center">
                <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="truncate cursor-pointer" onClick={() => setIsPlayerExpanded(true)}>
              <h5 className="text-sm font-bold text-white truncate">{activeSong.title}</h5>
              <p className="text-xs text-gray-400 truncate">{activeSong.genre} · Key of {activeSong.musicKey || chords[0]}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center max-w-2xl px-4">
            <div className="flex items-center gap-6 mb-2">
              <button 
                onClick={stop}
                className="text-gray-400 hover:text-white transition-colors"
                title="Stop"
              >
                <span className="material-symbols-outlined">stop</span>
              </button>
              <button 
                onClick={() => isPlaying ? pause() : play()}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
                title={isPlaying ? "Pause" : "Play"}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>
              <button 
                onClick={() => setIsPlayerExpanded(true)}
                className="text-gray-400 hover:text-white transition-colors flex items-center"
                title="Open Choir Desk"
              >
                <span className="material-symbols-outlined">equalizer</span>
              </button>
            </div>
            {/* Live Chord Progress indicator */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-400">Chords:</span>
              <div className="flex-grow flex gap-1 justify-center">
                {chords.map((chord, idx) => {
                  const isActive = isPlaying && currentChordIdx === idx;
                  return (
                    <span 
                      key={idx} 
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        isActive ? "bg-suno-accent/20 text-suno-accent border-suno-accent/40 font-bold scale-105" : "bg-suno-gray-800 text-gray-400 border-transparent"
                      }`}
                    >
                      {chord}
                    </span>
                  );
                })}
              </div>
              <span className="text-[11px] font-mono text-suno-accent font-bold">{bpm} BPM</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 w-1/4 hidden md:flex">
            <button 
              onClick={() => setIsPlayerExpanded(true)}
              className="px-4 py-2 bg-suno-accent/10 hover:bg-suno-accent/20 text-suno-accent text-xs font-bold rounded-full border border-suno-accent/20 flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">equalizer</span>
              Choir Desk
            </button>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Shell */}
      <nav className={`md:hidden fixed ${activeSong ? "bottom-24" : "bottom-0"} left-0 w-full bg-suno-gray-900 border-t border-suno-gray-800 flex justify-around items-center h-20 px-4 pb-safe z-50 rounded-t-xl shadow-[0_-8px_30px_rgb(0,0,0,0.5)] transition-all duration-300`}>
        <button
          onClick={() => setTab("home")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "home" ? "text-suno-accent" : "text-gray-400"}`}
        >
          <span className="material-symbols-outlined">explore</span>
          <span className="text-[10px] font-bold mt-1">Discover</span>
        </button>
        <button
          onClick={() => setTab("create")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "create" ? "text-suno-accent" : "text-gray-400"}`}
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="text-[10px] font-bold mt-1">Create</span>
        </button>
        <button
          onClick={() => setTab("library")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "library" ? "text-suno-accent" : "text-gray-400"}`}
        >
          <span className="material-symbols-outlined">library_music</span>
          <span className="text-[10px] font-bold mt-1">Library</span>
        </button>
      </nav>

      {/* Expanded Player overlay */}
      {isPlayerExpanded && activeSong && (
        <div className="fixed inset-0 bg-suno-black/95 backdrop-blur-2xl z-[100] overflow-y-auto">
          <Player 
            song={activeSong} 
            audioState={audioState} 
            onClose={() => setIsPlayerExpanded(false)} 
          />
        </div>
      )}

      {/* Full-Screen Drawer Menu (Hamburger Overlay) */}
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
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-lg mb-3">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mt-1">Gospel Music App</p>
          </div>
          <nav className="flex flex-col items-center space-y-6">
            <button
              onClick={() => { setTab("home"); setMenuOpen(false); }}
              className={`text-xl font-medium transition-colors ${tab === "home" ? "text-suno-accent" : "text-gray-400 hover:text-white"}`}
            >
              Discover
            </button>
            <button
              onClick={() => { setTab("create"); setMenuOpen(false); }}
              className={`text-xl font-medium transition-colors ${tab === "create" ? "text-suno-accent" : "text-gray-400 hover:text-white"}`}
            >
              Create Studio
            </button>
            <button
              onClick={() => { setTab("library"); setMenuOpen(false); }}
              className={`text-xl font-medium transition-colors ${tab === "library" ? "text-suno-accent" : "text-gray-400 hover:text-white"}`}
            >
              Library
            </button>
            <div className="w-16 h-[1px] bg-suno-gray-800"></div>
            <button
              onClick={() => { setTab("home"); setMenuOpen(false); }}
              className="text-base text-gray-500 hover:text-white transition-colors"
            >
              About
            </button>
            <button
              onClick={() => { setTab("home"); setMenuOpen(false); }}
              className="text-base text-gray-500 hover:text-white transition-colors"
            >
              Contact
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
