import { useState, useEffect } from "react";
import { StemRow } from "./StemRow";

export const Player = ({ song, audioState, onClose, onUpdateSong }) => {
  const { isPlaying, currentChordIdx, bpm, setBpm, play, pause, stop, volumes, setVolume, exportWav, exportMidi } = audioState;
  const chords = song.chords && song.chords.length > 0 ? song.chords : ["C", "F", "G", "Am"];

  const [mode, setMode] = useState("choir"); // "choir" (Choir Practice Mode) or "workstation" (Song Part Workstation)
  const [isGeneratingStems, setIsGeneratingStems] = useState(false);
  const [stemUrls, setStemUrls] = useState(null);

  const [stemState, setStemState] = useState({
    lead:    { vol: 90, solo: false, muted: false },
    soprano: { vol: 85, solo: false, muted: false },
    alto:    { vol: 80, solo: false, muted: false },
    tenor:   { vol: 75, solo: false, muted: false },
  });

  // Expired state validation: 48 hours limit
  const isExpired = song.created_at && (Date.now() - song.created_at) > 48 * 60 * 60 * 1000;

  const [stemsError, setStemsError]   = useState(null);

  // Precompute chord-to-lyric index mapping
  const chordToLyricMap = [];
  const flatLyricsText = [];
  (song.lyrics || []).forEach((l, lineIdx) => {
    const chordsList = l.chords || [];
    chordsList.forEach(() => {
      chordToLyricMap.push(lineIdx);
      flatLyricsText.push(l.line || "");
    });
  });

  const activeLyricIdx = chordToLyricMap[currentChordIdx] ?? 0;

  const generateLocalStems = async () => {
    setIsGeneratingStems(true);
    setStemsError(null);
    try {
      const { getSATBNotesForChords, renderVoiceStemWav, bufferToWav } = await import("../lib/useGospelAudio");
      const satb = getSATBNotesForChords(chords);
      
      const voices = ["soprano", "alto", "tenor", "lead"];
      const renderedUrls = {};
      
      for (const voice of voices) {
        const notesByChord = satb[voice].map(note => [note]);
        const buffer = await renderVoiceStemWav(notesByChord, voice, bpm, flatLyricsText);
        const wavBlob = bufferToWav(buffer);
        renderedUrls[voice] = URL.createObjectURL(wavBlob);
      }
      
      setStemUrls(renderedUrls);
    } catch (e) {
      console.error(e);
      setStemsError({ type: "error", message: "Local synthesis failed: " + e.message });
    } finally {
      setIsGeneratingStems(false);
    }
  };

  const generateCloudStems = async () => {
    setIsGeneratingStems(true);
    setStemsError(null);
    try {
      const res = await fetch("/api/stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics:   song.lyrics,
          genre:    song.genre    || "Contemporary",
          musicKey: song.musicKey || chords[0] || "G",
          chords:   chords,
          title:    song.title,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const fallbackErrors = ["no_hf_key", "backend_unavailable"];
        if (fallbackErrors.includes(data.error)) {
          setStemsError({
            type:    "setup",
            message: "Python backend unavailable. Falling back to Local High-Fidelity Synthesizer.",
          });
          await generateLocalStems();
        } else if (data.error === "model_loading") {
          setStemsError({
            type:    "retry",
            message: "Synthesis is still loading (cold start). Wait ~30s and try again, or use Local High-Fidelity Synthesizer.",
          });
        } else {
          setStemsError({ 
            type: "error", 
            message: `${data.message || "Cloud synthesis failed."} Automatically falling back to Local High-Fidelity Synthesizer.` 
          });
          await generateLocalStems();
        }
        return;
      }

      if (data.stems) {
        // stems are absolute WAV URLs from the Python backend — usable directly in <audio> tags
        setStemUrls(data.stems);
      }
    } catch (e) {
      console.error(e);
      setStemsError({ 
        type: "error", 
        message: "Could not reach the backend. Automatically falling back to Local High-Fidelity Synthesizer." 
      });
      await generateLocalStems();
    }
  };

  const updateStem = (key, field, val) =>
    setStemState((s) => ({ ...s, [key]: { ...s[key], [field]: val } }));

  const handlePlayPause = () => (isPlaying ? pause() : play());
  const handleStop = () => { stop(); };

  const handleLyricLineChange = (index, field, val) => {
    if (isExpired) return;
    const updatedLyrics = [...(song.lyrics || [])];
    updatedLyrics[index] = { ...updatedLyrics[index], [field]: val };
    if (onUpdateSong) {
      onUpdateSong({ ...song, lyrics: updatedLyrics });
    }
  };

  const handleChordsChange = (val) => {
    if (isExpired) return;
    const updatedChords = val.split(/[\s,]+/).map(c => c.trim()).filter(c => c.length > 0);
    if (onUpdateSong) {
      onUpdateSong({ ...song, chords: updatedChords });
    }
  };

  const stemColors = { lead: "#8B5CF6", soprano: "#F59E0B", alto: "#10B981", tenor: "#06B6D4" };
  const stemLabels = { lead: "Lead Vocals", soprano: "Soprano Harmony", alto: "Alto Harmony", tenor: "Tenor Harmony" };

  return (
    <div className="min-h-screen bg-suno-black text-white flex flex-col p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between border-b border-suno-gray-800 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-3 bg-suno-gray-800 rounded-full hover:bg-suno-gray-700 active:scale-95 transition-all text-gray-400 hover:text-white"
            title="Back to Dashboard"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <span className="px-3 py-1 rounded-full bg-suno-accent/15 text-suno-accent border border-suno-accent/30 text-[10px] font-bold uppercase tracking-widest">
              Choir Desk & Rehearsal
            </span>
            <h1 className="font-display text-2xl md:text-3xl text-white font-bold mt-1">{song.title}</h1>
          </div>
        </div>
        
        {/* Toggle between Choir Mode & Workstation Editor */}
        <div className="flex items-center bg-suno-gray-900 border border-suno-gray-800 p-1.5 rounded-full self-start md:self-auto shadow-inner">
          <button
            onClick={() => setMode("choir")}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              mode === "choir" 
                ? "bg-suno-accent text-white shadow-md" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            Choir Practice Mode
          </button>
          <button
            onClick={() => setMode("workstation")}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              mode === "workstation" 
                ? "bg-suno-accent text-white shadow-md" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            Song Part Workstation
          </button>
        </div>
        
        <div className="text-right hidden lg:block">
          <p className="text-sm font-bold text-suno-accent">{song.genre}</p>
          <p className="text-xs text-gray-400">Key of {song.musicKey || chords[0]} · {song.lang}</p>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* =================================================================== */}
        {/* CHOIR PRACTICE MODE                                                 */}
        {/* =================================================================== */}
        {mode === "choir" && (
          <>
            {/* Left Column: Prompter Sheet */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl relative overflow-hidden group flex flex-col justify-between min-h-[350px]">
                <div className="absolute -right-24 -top-24 w-64 h-64 bg-suno-accent/5 blur-[100px] rounded-full group-hover:bg-suno-accent/10 transition-all duration-700"></div>
                
                <div className="flex items-center justify-between border-b border-suno-gray-800 pb-4 z-10">
                  <span className="text-xs text-suno-accent font-bold uppercase tracking-widest">Choir Prompt Sync</span>
                  <div className="flex items-center gap-2 bg-suno-gray-800 px-3 py-1 rounded-full border border-suno-gray-700">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}></span>
                    <span className="text-xs text-gray-400 font-bold">{isPlaying ? "Active Playback" : "Idle"}</span>
                  </div>
                </div>

                {/* Lyric Prompter Box */}
                <div className="flex-1 flex flex-col justify-center py-6 z-10">
                  {song.lyrics && song.lyrics[activeLyricIdx] ? (
                    <div className="text-center space-y-4">
                      <span className="px-3 py-1 rounded-full bg-suno-gray-800 border border-suno-gray-700 text-xs font-bold text-suno-accent uppercase tracking-wider">
                        {song.lyrics[activeLyricIdx].part}
                      </span>
                      <p className="text-2xl md:text-3xl font-display font-extrabold text-white leading-relaxed px-4 md:px-8">
                        "{song.lyrics[activeLyricIdx].line}"
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-500 italic">Press play below to start rehearsal monitor</p>
                    </div>
                  )}
                </div>

                {/* Arrangement Monitor */}
                {song.lyrics && song.lyrics[activeLyricIdx] && (
                  <div className="z-10 flex items-center justify-center gap-4 bg-suno-gray-950/60 border border-suno-gray-850 px-4 py-2.5 rounded-2xl max-w-md mx-auto w-full backdrop-blur-sm mb-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Dynamics</span>
                      <span className={`text-xs font-mono font-bold uppercase ${
                        song.lyrics[activeLyricIdx].arrangement?.dynamics === "forte" ? "text-rose-400" :
                        song.lyrics[activeLyricIdx].arrangement?.dynamics === "piano" ? "text-cyan-400" : "text-amber-400"
                      }`}>
                        {song.lyrics[activeLyricIdx].arrangement?.dynamics || "mezzo"}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-suno-gray-800"></div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Arrangement</span>
                      <span className="text-xs font-mono font-bold text-suno-accent uppercase">
                        {song.lyrics[activeLyricIdx].arrangement?.percussion === "solo" ? "Drum Solo" :
                         song.lyrics[activeLyricIdx].arrangement?.percussion === "mute" ? "Acapella" :
                         song.lyrics[activeLyricIdx].arrangement?.percussion === "light" ? "Light Band" : "Full Band"}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-suno-gray-800"></div>
                    <div className="flex items-center gap-2">
                      {["piano", "percussion", "bass", "guitar"].map((inst) => {
                        const isPercSolo = song.lyrics[activeLyricIdx].arrangement?.percussion === "solo";
                        const isPercMuted = song.lyrics[activeLyricIdx].arrangement?.percussion === "mute";
                        const isActive = inst === "percussion" ? (!isPercMuted) : (!isPercSolo);
                        const icon = inst === "piano" ? "piano" : inst === "percussion" ? "drum" : inst === "bass" ? "music_note" : "guitar";
                        return (
                          <span
                            key={inst}
                            className={`material-symbols-outlined text-sm p-1 rounded ${
                              isActive ? "text-suno-accent bg-suno-accent/10 border border-suno-accent/20" : "text-gray-600 bg-suno-gray-800/40 border border-transparent"
                            }`}
                            title={`${inst.toUpperCase()} - ${isActive ? "Active" : "Inactive"}`}
                          >
                            {icon}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chords Arranger */}
                <div className="border-t border-suno-gray-800 pt-6 z-10">
                  <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-4">
                    Active Chords Guide
                  </p>
                  <div className="flex justify-center flex-wrap gap-3">
                    {chords.map((chord, i) => {
                      const isActive = isPlaying && currentChordIdx === i;
                      return (
                        <div 
                          key={i} 
                          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 font-mono text-sm ${
                            isActive 
                              ? "bg-suno-accent/20 border-suno-accent text-suno-accent shadow-[0_0_20px_rgba(35,212,94,0.25)] scale-110 font-bold"
                              : "bg-suno-gray-800 border-suno-gray-700 text-gray-400"
                          }`}
                        >
                          {chord}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleStop} 
                    className="p-4 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-2xl active:scale-95 transition-all text-gray-400 hover:text-white"
                    title="Stop Playback"
                  >
                    <span className="material-symbols-outlined">stop</span>
                  </button>
                  <button 
                    onClick={handlePlayPause} 
                    className={`w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ${
                      isPlaying 
                        ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20" 
                        : "bg-suno-accent text-white shadow-suno-accent/20"
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </button>
                  <div className="text-left ml-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Playback</p>
                    <p className="text-sm text-white font-bold">{isPlaying ? "Rehearsal Live" : "Stopped"}</p>
                  </div>
                </div>

                <div className="flex-1 max-w-xs w-full flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tempo</span>
                  <input
                    type="range" 
                    min={50} 
                    max={160} 
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="flex-grow accent-suno-accent h-1 bg-suno-gray-700 rounded-full"
                  />
                  <span className="text-sm font-mono font-bold text-suno-accent w-12 text-right">{bpm}</span>
                </div>
              </div>

              {/* AV Department Exports */}
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-suno-accent text-lg">download</span>
                  AV Department Production Exports
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={exportWav}
                    className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-suno-gray-800 hover:bg-suno-gray-750 border border-suno-gray-700 text-white text-sm font-bold active:scale-98 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">music_note</span>
                    Export Backing Track (WAV)
                  </button>
                  <button
                    onClick={exportMidi}
                    className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-suno-gray-800 hover:bg-suno-gray-750 border border-suno-gray-700 text-white text-sm font-bold active:scale-98 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">piano</span>
                    Export Chord Sheet (MIDI)
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: SAT Stems Mixer */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl">
                <h3 className="text-lg text-white font-bold mb-4 flex items-center gap-2 font-display">
                  <span className="material-symbols-outlined text-suno-accent">equalizer</span>
                  Choir SAT Harmonies (ACE-Step)
                </h3>
                <div className="space-y-3">
                  {Object.entries(stemState).map(([key, s]) => (
                    <StemRow
                      key={key}
                      label={stemLabels[key]}
                      color={stemColors[key]}
                      vol={s.vol}
                      setVol={(v) => updateStem(key, "vol", v)}
                      solo={s.solo}
                      setSolo={(v) => updateStem(key, "solo", v)}
                      muted={s.muted}
                      setMuted={(v) => updateStem(key, "muted", v)}
                      url={stemUrls ? stemUrls[key] : null}
                      isPlaying={isPlaying}
                    />
                  ))}
                </div>

                {stemUrls ? (
                  <div className="w-full mt-6 py-4 rounded-2xl font-bold text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    SAT Harmonies Loaded & Ready
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={generateLocalStems}
                      disabled={isGeneratingStems}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all ${
                        isGeneratingStems 
                          ? "bg-suno-gray-800 border-suno-gray-700 text-gray-500 cursor-wait" 
                          : "bg-suno-accent/10 border-suno-accent/20 text-suno-accent hover:bg-suno-accent/20 hover:border-suno-accent"
                      }`}
                    >
                      {isGeneratingStems ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                          Synthesizing SAT Stems...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">piano</span>
                          Synthesize Local High-Fidelity Choir Synth
                        </>
                      )}
                    </button>

                    <button
                      onClick={generateCloudStems}
                      disabled={isGeneratingStems}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all ${
                        isGeneratingStems 
                          ? "bg-suno-gray-800 border-suno-gray-700 text-gray-500 cursor-wait" 
                          : "bg-suno-gray-800 border-suno-gray-700 text-gray-300 hover:bg-suno-gray-750 hover:text-white"
                      }`}
                    >
                      {isGeneratingStems ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                          Synthesizing SAT Stems...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">cloud_sync</span>
                          Synthesize via Cloud AI (Hugging Face)
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Stem error feedback */}
                {stemsError && (
                  <div className={`mt-3 p-4 rounded-2xl border text-sm flex items-start gap-3 ${
                    stemsError.type === "setup"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    <span className="material-symbols-outlined text-lg mt-0.5 shrink-0">
                      {stemsError.type === "setup" ? "key" : stemsError.type === "retry" ? "update" : "error"}
                    </span>
                    <div>
                      <p className="font-bold text-xs uppercase tracking-wider mb-1">
                        {stemsError.type === "setup" ? "HF Key Required" : stemsError.type === "retry" ? "Model Loading" : "Synthesis Error"}
                      </p>
                      <p className="text-xs leading-relaxed">{stemsError.message}</p>
                      {stemsError.link && (
                        <a
                          href={stemsError.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline mt-1 inline-block opacity-80 hover:opacity-100"
                        >
                          Get free HF token →
                        </a>
                      )}
                      {stemsError.type === "retry" && (
                        <button
                          onClick={generateCloudStems}
                          className="text-xs underline mt-1 inline-block opacity-80 hover:opacity-100"
                        >
                          Retry now →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* =================================================================== */}
        {/* SONG PART WORKSTATION EDITOR                                        */}
        {/* =================================================================== */}
        {mode === "workstation" && (
          <div className="lg:col-span-12 flex flex-col md:flex-row gap-8 w-full relative">
            
            {/* Lock overlay if song has expired (>48 hours) */}
            {isExpired && (
              <div className="absolute inset-0 bg-suno-black/80 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center p-6 border border-suno-gray-800 text-center">
                <span className="material-symbols-outlined text-red-500 text-5xl mb-4">lock</span>
                <h3 className="text-xl font-bold text-white font-display">Workstation Session Locked</h3>
                <p className="text-sm text-gray-400 max-w-md mt-2">
                  This song was generated more than 48 hours ago. Dynamic mixing, part editing, and structure modifications are restricted to premium subscribers.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-2.5 rounded-full bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

            {/* Left: Instrumental mixer */}
            <div className="w-full md:w-1/3 space-y-6">
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl">
                <h3 className="text-base text-white font-bold mb-5 flex items-center gap-2 font-display">
                  <span className="material-symbols-outlined text-suno-accent">tune</span>
                  Instrument Mixer
                </h3>
                <div className="space-y-6">
                  {Object.keys(volumes).map((inst) => (
                    <div key={inst} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white capitalize">{inst}</span>
                        <span className="text-[10px] font-mono text-suno-accent font-bold">
                          {Math.round(volumes[inst] * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-500 text-lg">
                          {inst === "piano" ? "piano" : inst === "percussion" ? "drum" : inst === "bass" ? "music_note" : "guitar"}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(volumes[inst] * 100)}
                          onChange={(e) => setVolume(inst, Number(e.target.value) / 100)}
                          className="flex-grow accent-suno-accent h-1 bg-suno-gray-800 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 border-t border-suno-gray-800 pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={handleStop}
                      className="p-3.5 bg-suno-gray-800 hover:bg-suno-gray-750 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95"
                      title="Stop Playback"
                    >
                      <span className="material-symbols-outlined text-base">stop</span>
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className="flex-grow py-3 rounded-xl bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md transition-transform"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isPlaying ? "pause" : "play_arrow"}
                      </span>
                      {isPlaying ? "Pause Rehearsal" : "Play Backing track"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Structure Editor (Lyrics & Chords) */}
            <div className="flex-1 space-y-6">
              <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl">
                <h3 className="text-base text-white font-bold mb-4 flex items-center gap-2 font-display">
                  <span className="material-symbols-outlined text-suno-accent">edit_note</span>
                  Song Structure Editor
                </h3>

                {/* Edit Chords Progression */}
                <div className="space-y-2 mb-6">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    Global Chords Loop (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={chords.join(", ")}
                    onChange={(e) => handleChordsChange(e.target.value)}
                    className="w-full bg-suno-gray-850 border border-suno-gray-700 focus:border-suno-accent rounded-xl px-4 py-3 text-sm font-mono text-suno-accent focus:outline-none transition-colors"
                    placeholder="e.g. C, F, G, Am"
                  />
                </div>

                {/* Edit Lyrics Lines */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    Song Parts & Lyrics
                  </label>
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                    {song.lyrics && song.lyrics.map((l, index) => (
                      <div key={index} className="flex gap-3 p-3 bg-suno-gray-850 border border-suno-gray-800 rounded-2xl items-start">
                        <input
                          type="text"
                          value={l.part}
                          onChange={(e) => handleLyricLineChange(index, "part", e.target.value)}
                          className="w-20 bg-suno-gray-900 border border-suno-gray-750 focus:border-suno-accent rounded-lg px-2.5 py-1.5 text-center text-xs font-bold text-suno-accent focus:outline-none transition-colors"
                          placeholder="Part"
                        />
                        <input
                          type="text"
                          value={l.line}
                          onChange={(e) => handleLyricLineChange(index, "line", e.target.value)}
                          className="flex-1 bg-suno-gray-900 border border-suno-gray-750 focus:border-suno-accent rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-colors"
                          placeholder="Lyrics Line"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
        
      </div>
    </div>
  );
};
