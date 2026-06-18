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
    <div className="bg-background text-on-surface font-body-md selection:bg-primary/30 min-h-screen overflow-x-hidden">
      <Head>
        <title>SelahAI | Gospel Music Co-Writer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </Head>

      <GeneratingModal visible={generating} />

      {/* Sidebar Navigation Shell (Hidden on Mobile) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container/70 backdrop-blur-2xl border-r border-white/5 shadow-2xl flex flex-col p-6 space-y-4 z-50 hidden md:flex">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-on-primary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold">SelahAI</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Creative Studio</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setTab("home")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold ${
              tab === "home" ? "bg-primary/20 text-primary border border-primary/30" : "text-on-surface-variant hover:bg-white/5 border border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">explore</span>
            <span className="font-body-md text-body-md">Discover</span>
          </button>
          <button
            onClick={() => setTab("create")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold ${
              tab === "create" ? "bg-primary/20 text-primary border border-primary/30" : "text-on-surface-variant hover:bg-white/5 border border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span className="font-body-md text-body-md">Create Studio</span>
          </button>
          <button
            onClick={() => setTab("library")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold ${
              tab === "library" ? "bg-primary/20 text-primary border border-primary/30" : "text-on-surface-variant hover:bg-white/5 border border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">library_music</span>
            <span className="font-body-md text-body-md">Library</span>
          </button>
        </nav>

        <button
          onClick={() => setTab("create")}
          className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-on-primary-fixed font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          New Generation
        </button>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <div className="text-[11px] text-center text-on-surface-variant italic">
            Kingdom Hack 3.0 MVP
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`md:ml-64 ${activeSong ? "pb-44" : "pb-24"} min-h-screen transition-all duration-300`}>
        {/* Top Header Anchor */}
        <header className="h-16 px-margin-desktop flex items-center justify-between sticky top-0 z-40 bg-background/50 backdrop-blur-md hidden md:flex border-b border-white/5">
          <div className="flex items-center gap-6">
            <div className="relative w-96">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full pl-12 pr-6 py-2 text-body-md font-body-md focus:ring-1 focus:ring-primary text-on-surface placeholder:text-outline"
                placeholder="Search for songs, themes, scriptures..."
                type="text"
                disabled
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-label-sm font-label-sm tracking-widest text-primary uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
              SelahAI v2.4 Engine
            </div>
          </div>
        </header>

        {/* Dynamic Tab Render */}
        <div className="px-4 md:px-margin-desktop pt-6">
          {tab === "home" && <HomeTab songs={songs} onPlay={handleSongSelect} />}
          {tab === "create" && <CreateTab onGenerate={handleGenerate} />}
          {tab === "library" && <LibraryTab songs={songs} onPlay={handleSongSelect} />}
        </div>
      </main>

      {/* Persistent Player Bar */}
      {activeSong && (
        <footer className="fixed bottom-0 md:bottom-0 left-0 w-full bg-surface-container-highest/90 backdrop-blur-xl border-t border-white/10 h-24 z-[60] flex items-center px-4 md:px-8 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] justify-between">
          <div className="flex items-center gap-4 w-1/3 md:w-1/4">
            <div 
              onClick={() => setIsPlayerExpanded(true)}
              className="w-14 h-14 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0 shadow-lg border border-white/10 cursor-pointer group relative"
            >
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">open_in_full</span>
              </div>
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-2xl">
                🎵
              </div>
            </div>
            <div className="truncate cursor-pointer" onClick={() => setIsPlayerExpanded(true)}>
              <h5 className="text-body-md font-bold text-white truncate">{activeSong.title}</h5>
              <p className="text-label-sm text-on-surface-variant truncate">{activeSong.genre} · Key of {activeSong.musicKey || chords[0]}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center max-w-2xl px-4">
            <div className="flex items-center gap-6 mb-2">
              <button 
                onClick={stop}
                className="text-on-surface-variant hover:text-white transition-colors"
                title="Stop"
              >
                <span className="material-symbols-outlined">stop</span>
              </button>
              <button 
                onClick={() => isPlaying ? pause() : play()}
                className="w-10 h-10 rounded-full bg-white text-background flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                title={isPlaying ? "Pause" : "Play"}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>
              <button 
                onClick={() => setIsPlayerExpanded(true)}
                className="text-on-surface-variant hover:text-white transition-colors flex items-center"
                title="Open Choir Desk"
              >
                <span className="material-symbols-outlined">equalizer</span>
              </button>
            </div>
            {/* Live Chord Progress indicator */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-mono text-on-surface-variant">Chords:</span>
              <div className="flex-grow flex gap-1 justify-center">
                {chords.map((chord, idx) => {
                  const isActive = isPlaying && currentChordIdx === idx;
                  return (
                    <span 
                      key={idx} 
                      className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${
                        isActive ? "bg-primary/20 text-primary border-primary/50 font-bold scale-105" : "bg-white/5 text-on-surface-variant border-transparent"
                      }`}
                    >
                      {chord}
                    </span>
                  );
                })}
              </div>
              <span className="text-[11px] font-mono text-primary font-bold">{bpm} BPM</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 w-1/4 hidden md:flex">
            <button 
              onClick={() => setIsPlayerExpanded(true)}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold rounded-full border border-primary/30 flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">equalizer</span>
              Choir Desk
            </button>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Shell */}
      <nav className={`md:hidden fixed ${activeSong ? "bottom-24" : "bottom-0"} left-0 w-full bg-surface-container-highest/90 backdrop-blur-lg border-t border-white/10 flex justify-around items-center h-20 px-4 pb-safe z-50 rounded-t-xl shadow-[0_-8px_30px_rgb(0,0,0,0.5)] transition-all duration-300`}>
        <button
          onClick={() => setTab("home")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "home" ? "text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined">explore</span>
          <span className="font-label-sm text-label-sm mt-1">Discover</span>
        </button>
        <button
          onClick={() => setTab("create")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "create" ? "text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="font-label-sm text-label-sm mt-1">Create</span>
        </button>
        <button
          onClick={() => setTab("library")}
          className={`flex flex-col items-center active:scale-90 transition-transform ${tab === "library" ? "text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined">library_music</span>
          <span className="font-label-sm text-label-sm mt-1">Library</span>
        </button>
      </nav>

      {/* Expanded Player overlay */}
      {isPlayerExpanded && activeSong && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-[100] overflow-y-auto">
          <Player 
            song={activeSong} 
            audioState={audioState} 
            onClose={() => setIsPlayerExpanded(false)} 
          />
        </div>
      )}
    </div>
  );
}
