import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { StemRow } from "./StemRow";
import { AuthRequiredModal } from "./AuthRequiredModal";
import { supabase } from "../lib/supabase";

const validateChords = (text) => {
  const errors = [];
  const warnings = [];

  if (!text || !text.trim()) {
    errors.push("Chord list cannot be empty.");
    return { errors, warnings, parsed: [] };
  }

  if (/[^a-zA-Z0-9#\s,]/.test(text)) {
    errors.push("Invalid characters detected. Only letters, numbers, '#' and commas are allowed.");
  }

  if (/,{2,}/.test(text)) {
    errors.push("Double/consecutive commas are not allowed.");
  }

  const parsed = text.split(/[\s,]+/).map(c => c.trim()).filter(Boolean);

  const known = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B", "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm", "G7", "C7", "F7", "Cmaj7", "Gmaj7", "Fmaj7", "Am7", "Em7", "Dm7"];

  const invalidTokens = [];
  const unknownChords = [];

  parsed.forEach(chord => {
    const basicSyntax = /^[A-G][#b]?[a-zA-Z0-9]*$/i.test(chord);
    if (!basicSyntax) {
      invalidTokens.push(chord);
    } else {
      const standardized = chord.charAt(0).toUpperCase() + chord.slice(1);
      const isKnown = known.includes(standardized) || known.includes(standardized.replace(/[0-9]+$/, ""));
      if (!isKnown) {
        unknownChords.push(chord);
      }
    }
  });

  if (invalidTokens.length > 0) {
    errors.push(`Invalid chord format: ${invalidTokens.join(", ")} (must start with A-G)`);
  }

  if (unknownChords.length > 0) {
    warnings.push(`Unknown chord(s): ${unknownChords.join(", ")} (will playback as C chord)`);
  }

  return { errors, warnings, parsed };
};

const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
];

export const Player = ({
  song,
  audioState,
  onClose,
  onUpdateSong,
  user,
  comments,
  commentsLoading,
  newComment,
  setNewComment,
  handlePostComment,
  handleDeleteComment,
  handleLikeComment,
  recommendations,
  isLiked,
  likeCount,
  onLike,
  commentError,
  playSource,
  onNext,
  onPrev,
}) => {
  const {
    isPlaying, currentChordIdx, bpm, setBpm, play, pause, stop,
    volumes, setVolume, exportWav, exportMidi,
    loadStems, clearStems, applyStemGains, stemsLoaded, stemsLoading,
    loadBackingTrack, clearBackingTrack, backingTrackLoaded, backingTrackLoading,
  } = audioState;

  const chords = song.chords && song.chords.length > 0 ? song.chords : ["C", "F", "G", "Am"];
  const isOwner = !!(user && song.user_id && String(user.id) === String(song.user_id));

  const COVER_FALLBACKS = [
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
    "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
  ];
  const coverImage = song.cover_url || COVER_FALLBACKS[String(song.title).charCodeAt(0) % COVER_FALLBACKS.length];

  const [mode, setMode] = useState("choir");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();

  const [isGeneratingStems, setIsGeneratingStems] = useState(false);
  const [isSynthesizingLocal, setIsSynthesizingLocal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [stemUrls, setStemUrls] = useState(null);

  // AI-generated full-mix state (apiframe/Suno)
  const [aiAudioUrl, setAiAudioUrl] = useState(null);
  const [aiAudioTitle, setAiAudioTitle] = useState(null);
  const [aiTracks, setAiTracks] = useState(null);      // both Suno variants
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0);
  const [aiSource, setAiSource] = useState(null);      // "apiframe_suno" | null

  const [stemState, setStemState] = useState({
    lead:    { vol: 90, solo: false, muted: false },
    soprano: { vol: 85, solo: false, muted: false },
    alto:    { vol: 80, solo: false, muted: false },
    tenor:   { vol: 75, solo: false, muted: false },
  });

  const [backingTrackUrl, setBackingTrackUrl] = useState(null);
  const [isGeneratingBacking, setIsGeneratingBacking] = useState(false);
  const [backingError, setBackingError] = useState(null);
  const [stemsError, setStemsError] = useState(null);

  const [chordsInput, setChordsInput] = useState(chords.join(", "));
  const [chordValidation, setChordValidation] = useState({ errors: [], warnings: [] });

  useEffect(() => {
    if (song?.chords) {
      const currentParsed = chordsInput.split(/[\s,]+/).map(c => c.trim()).filter(Boolean);
      const incomingChords = song.chords;
      const isSame = currentParsed.length === incomingChords.length && 
                     currentParsed.every((val, index) => {
                       if (val.length === 0) return false;
                       const standardized = val.charAt(0).toUpperCase() + val.slice(1);
                       return standardized === incomingChords[index];
                     });
      if (!isSame) {
        setChordsInput(song.chords.join(", "));
        const { errors, warnings } = validateChords(song.chords.join(", "));
        setChordValidation({ errors, warnings });
      }
    }
  }, [song?.chords]);

  // Sync stem URLs with Web Audio context loader (used for local synth stems)
  useEffect(() => {
    if (stemUrls && loadStems) {
      loadStems(stemUrls);
    }
  }, [stemUrls, loadStems]);

  // Sync volume/mute/solo changes to Web Audio gain nodes
  useEffect(() => {
    if (applyStemGains) {
      applyStemGains(stemState);
    }
  }, [stemState, applyStemGains]);

  // Sync backing track URL with audio context loader
  useEffect(() => {
    if (backingTrackUrl && loadBackingTrack) {
      loadBackingTrack(backingTrackUrl);
    }
  }, [backingTrackUrl, loadBackingTrack]);

  // When AI audio URL changes, load it as the backing track and silence the
  // local SATB choir voices — Suno already contains its own full vocal mix.
  useEffect(() => {
    if (aiAudioUrl && loadBackingTrack) {
      if (clearStems) clearStems();
      setStemUrls(null);
      loadBackingTrack(aiAudioUrl);
    }
  }, [aiAudioUrl, loadBackingTrack, clearStems]);

  // Load existing generated AI song data from song prop if available
  useEffect(() => {
    if (song) {
      setAiAudioUrl(song.audio_url || null);
      setAiTracks(song.tracks || null);
      setAiSource(song.ai_source || (song.audio_url ? "apiframe_suno" : null));
      setAiAudioTitle(song.title || null);
      if (song.tracks && song.audio_url) {
        const idx = song.tracks.findIndex(t => t.audio_url === song.audio_url);
        if (idx !== -1) setSelectedTrackIdx(idx);
      }
    }
  }, [song]);

  // Expired state validation: 48 hours limit
  const isExpired = song.created_at && (Date.now() - song.created_at) > 48 * 60 * 60 * 1000;

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

  // Auto-scroll the active lyric line into view in Spotify Karaoke style
  useEffect(() => {
    const activeEl = document.getElementById(`lyric-line-${activeLyricIdx}`);
    const container = document.getElementById("karaoke-lyrics-container");
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      container.scrollTop += elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);
    }
  }, [activeLyricIdx]);

  // ── Local Web Audio synth (instant preview fallback) ──────────────────────
  const generateLocalStems = async () => {
    if (stop) stop();
    setIsSynthesizingLocal(true);
    setStemsError(null);
    setAiAudioUrl(null);
    setAiSource(null);
    try {
      const { getSATBNotesForChords, renderVoiceStemWav, bufferToWav } = await import("../lib/useGospelAudio");
      const satb = getSATBNotesForChords(chords);
      const voices = ["soprano", "alto", "tenor", "lead"];
      const renderedUrls = {};
      for (const voice of voices) {
        const notesByChord = satb[voice].map((note) => [note]);
        const buffer = await renderVoiceStemWav(notesByChord, voice, bpm, flatLyricsText);
        const wavBlob = bufferToWav(buffer);
        renderedUrls[voice] = URL.createObjectURL(wavBlob);
      }
      // Clear any Suno backing so local voices aren't layered under a full-mix.
      if (clearBackingTrack) clearBackingTrack();
      setAiAudioUrl(null);
      setAiSource(null);
      setStemUrls(renderedUrls);
    } catch (e) {
      console.error(e);
      setStemsError({ type: "error", message: "Local synthesis failed: " + e.message });
    } finally {
      setIsSynthesizingLocal(false);
    }
  };

  // ── AI Song Generation (apiframe.ai / Suno) ───────────────────────────────
  const generateCloudStems = async () => {
    if (!isOwner) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (stop) stop();
    setIsGeneratingStems(true);
    setElapsedTime(0);
    setGenerationStage("Submitting request to AI backend...");
    setStemsError(null);
    setStemUrls(null);
    setAiAudioUrl(null);
    setAiTracks(null);
    setAiSource(null);

    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      setGenerationStage("Suno is composing & rendering (this may take 30-120 seconds)...");
      const res = await fetch("/api/stems", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics:       song.lyrics,
          genre:        song.genre        || "Contemporary",
          musicKey:     song.musicKey     || chords[0] || "G",
          chords:       chords,
          title:        song.title,
          emotional_mode: song.emotional_mode || null,
          instrumentation: song.instrumentation || null,
          vocal_gender: song.vocal_gender  || null,
        }),
      });

      if (res.status === 401) {
        clearInterval(timer);
        setIsGeneratingStems(false);
        setGenerationStage("");
        alert("Your session has expired. Redirecting to sign in page...");
        await supabase.auth.signOut();
        router.push("/auth");
        return;
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        clearInterval(timer);
        setIsGeneratingStems(false);
        setGenerationStage("");

        if (data.fallback === "web_audio") {
          setStemsError({
            type:    "setup",
            message: `AI generation unavailable: ${data.message || "backend unreachable"}. Using local synthesizer.`,
          });
          await generateLocalStems();
        } else {
          setStemsError({ type: "error", message: data.message || "AI song generation failed." });
          await generateLocalStems();
        }
        return;
      }

      if (data.audio_url) {
        const updated = {
          ...song,
          audio_url: data.audio_url,
          tracks: data.tracks || null,
          ai_source: data.source || "apiframe_suno",
        };
        if (onUpdateSong) {
          onUpdateSong(updated);
        }
        setAiAudioUrl(data.audio_url);
        setAiAudioTitle(data.audio_title || null);
        setAiTracks(data.tracks || null);
        setAiSource(data.source || "apiframe_suno");
        setSelectedTrackIdx(0);
      }
    } catch (e) {
      console.error("[Player] Cloud AI error:", e);
      clearInterval(timer);
      setIsGeneratingStems(false);
      setGenerationStage("");

      setStemsError({
        type:    "error",
        message: "Could not reach the backend. Falling back to local synthesizer.",
      });
      await generateLocalStems();
    } finally {
      clearInterval(timer);
      setIsGeneratingStems(false);
      setGenerationStage("");
    }
  };

  const handleSelectTrack = (idx) => {
    if (!aiTracks || !aiTracks[idx]) return;
    setSelectedTrackIdx(idx);
    const selectedUrl = aiTracks[idx].audio_url;
    setAiAudioUrl(selectedUrl);
    if (loadBackingTrack) loadBackingTrack(selectedUrl);
    
    const updated = {
      ...song,
      audio_url: selectedUrl,
    };
    if (onUpdateSong) {
      onUpdateSong(updated);
    }
  };

  const generateCloudBacking = async () => {
    if (!isOwner) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (stop) stop();
    setIsGeneratingBacking(true);
    setBackingError(null);
    try {
      const { renderWavBuffer, bufferToWav } = await import("../lib/useGospelAudio");
      const buffer = await renderWavBuffer(chords, song.genre || "Contemporary", bpm);
      const wavBlob = bufferToWav(buffer);
      const reader = new FileReader();
      const base64DataUri = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(wavBlob);
      });
      const res = await fetch("/api/melody", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input_audio: base64DataUri, genre: song.genre || "Contemporary", bpm }),
      });
      if (res.status === 401) {
        alert("Your session has expired. Redirecting to sign in page...");
        await supabase.auth.signOut();
        router.push("/auth");
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.error === "no_replicate_token") {
          throw new Error("REPLICATE_API_TOKEN is missing. Please set it in .env.local.");
        }
        throw new Error(data.message || "Cloud backing track synthesis failed.");
      }
      if (data.backing_url) setBackingTrackUrl(data.backing_url);
    } catch (e) {
      console.error("Cloud Backing Generation Error:", e);
      setBackingError(e.message);
    } finally {
      setIsGeneratingBacking(false);
    }
  };

  const updateStem = (key, field, val) =>
    setStemState((s) => ({ ...s, [key]: { ...s[key], [field]: val } }));

  const handlePlayPause = () => (isPlaying ? pause() : play());
  const handleStop = () => { stop(); };

  const handleLyricLineChange = (index, field, val) => {
    if (isExpired || !isOwner) return;
    const updatedLyrics = [...(song.lyrics || [])];
    updatedLyrics[index] = { ...updatedLyrics[index], [field]: val };
    if (onUpdateSong) onUpdateSong({ ...song, lyrics: updatedLyrics });
  };

  const handleChordsInputChange = (val) => {
    if (isExpired || !isOwner) return;
    setChordsInput(val);
    const { errors, warnings, parsed } = validateChords(val);
    setChordValidation({ errors, warnings });

    if (errors.length === 0 && parsed.length > 0) {
      const standardized = parsed.map(chord => chord.charAt(0).toUpperCase() + chord.slice(1));
      if (onUpdateSong) {
        onUpdateSong({ ...song, chords: standardized });
      }
    }
  };

  const handleChordsInputBlur = () => {
    if (isExpired || !isOwner) return;
    const { errors, parsed } = validateChords(chordsInput);
    if (errors.length === 0 && parsed.length > 0) {
      const standardized = parsed.map(chord => chord.charAt(0).toUpperCase() + chord.slice(1));
      setChordsInput(standardized.join(", "));
      if (onUpdateSong) {
        onUpdateSong({ ...song, chords: standardized });
      }
    }
  };

  const stemColors  = { lead: "#8B5CF6", soprano: "#F59E0B", alto: "#10B981", tenor: "#06B6D4" };
  const stemLabels  = { lead: "Lead Vocals", soprano: "Soprano Harmony", alto: "Alto Harmony", tenor: "Tenor Harmony" };

  // Whether an AI full-mix is active (collapses the SATB mixer to a single channel)
  const isAiMixActive = aiSource === "apiframe_suno" && !!aiAudioUrl;

  const handleShare = async () => {
    const url = `${window.location.origin}/song/${song.id}`;
    const text = `🎵 "${song.title}" — gospel arrangement on Selah`;
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: song.title, text, url }).catch(() => {});
    } else if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleTogglePublish = async () => {
    if (!isOwner) return;
    const nextIsPublic = song.is_public === false ? true : !song.is_public;
    const updated = {
      ...song,
      is_public: nextIsPublic,
    };
    if (onUpdateSong) {
      await onUpdateSong(updated);
    }
  };

  const [downloadingStemsZip, setDownloadingStemsZip] = useState(false);
  const [stemsZipError, setStemsZipError] = useState(null);

  const handleDownloadStemsZip = async () => {
    if (!song || !song.id) return;
    setDownloadingStemsZip(true);
    setStemsZipError(null);
    try {
      const res = await fetch("/api/song/stems-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id }),
      });

      if (res.status === 401) {
        alert("Your session has expired. Redirecting to sign in page...");
        await supabase.auth.signOut();
        router.push("/auth");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to package stems zip");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Selah_${song.title.replace(/[\s/\\?%*:|"<>]/g, "_")}_stems.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Player] Stems zip error:", err);
      setStemsZipError(err.message);
    } finally {
      setDownloadingStemsZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-suno-black text-white flex flex-col p-4 md:p-8">
      <AuthRequiredModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      {/* Header */}
      <header className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between border-b border-suno-gray-800 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-3 bg-suno-gray-800 rounded-full hover:bg-suno-gray-700 active:scale-95 transition-all text-gray-400 hover:text-white cursor-pointer"
            title="Back to Dashboard"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <span className="px-3 py-1 rounded-full bg-suno-accent/15 text-suno-accent border border-suno-accent/30 text-[10px] font-bold uppercase tracking-widest">
              Choir Desk &amp; Rehearsal
            </span>
            <h1 className="selah-title-lg mt-1">{song.title}</h1>
          </div>
        </div>

        {/* Mode toggle — only visible when Advanced is active */}
        {showAdvanced ? (
          <div className="flex items-center bg-suno-gray-900 border border-suno-gray-800 p-1.5 rounded-full self-start md:self-auto shadow-inner">
            <button
              onClick={() => setMode("choir")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                mode === "choir" ? "bg-suno-accent text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              Choir Practice Mode
            </button>
            <button
              onClick={() => setMode("workstation")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                mode === "workstation" ? "bg-suno-accent text-white shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              Song Part Workstation
            </button>
          </div>
        ) : (
          <div className="flex-1 md:max-w-xs"></div>
        )}

        <div className="flex items-center gap-3">
          {/* Toggle Button for Advanced Producer Tools */}
          <button
            onClick={() => setShowAdvanced(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all border active:scale-95 ${
              showAdvanced
                ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                : "bg-suno-gray-800 border-suno-gray-700 text-gray-300 hover:text-white hover:border-suno-gray-650"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{showAdvanced ? "close" : "tune"}</span>
            {showAdvanced ? "Hide Advanced" : "Show Advanced Producer Tools"}
          </button>

          {isOwner && (
            <button
              id="player-publish-btn"
              onClick={handleTogglePublish}
              className={`p-2.5 rounded-full active:scale-95 transition-all flex items-center justify-center border ${
                song.is_public
                  ? "bg-suno-accent/20 border-suno-accent/40 text-suno-accent hover:bg-suno-accent/30"
                  : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:text-white hover:border-suno-gray-600"
              }`}
              title={song.is_public ? "Published to Community (click to make private)" : "Private (click to publish to community)"}
            >
              <span className="material-symbols-outlined text-xl">
                {song.is_public ? "public" : "public_off"}
              </span>
            </button>
          )}

          <button
            id="player-share-btn"
            onClick={handleShare}
            className="p-2.5 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-full active:scale-95 transition-all text-gray-400 hover:text-white"
            title="Share this song"
          >
            <span className="material-symbols-outlined text-xl">share</span>
          </button>
          <div className="text-right hidden lg:block">
            <p className="text-sm font-bold text-suno-accent">{song.genre}</p>
            <p className="text-xs text-gray-450">Key of {song.musicKey || chords[0]} · {song.lang}</p>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="max-w-6xl mx-auto w-full flex-1">
        
        {/* ================================================================ */}
        {/* SIMPLE PRACTICE PLAYER VIEW (showAdvanced is FALSE)              */}
        {/* ================================================================ */}
        {!showAdvanced && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full animate-fadeIn">
            {/* Left: Styled Cover Graphic */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="selah-card rounded-3xl overflow-hidden relative group shadow-2xl flex flex-col">
                {/* Cover image */}
                <div className="relative w-full aspect-square overflow-hidden">
                  <img
                    src={coverImage}
                    alt={song.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
                    <div>
                      <h3 className="font-display text-xl font-bold text-white leading-tight line-clamp-2">{song.title}</h3>
                      <p className="selah-body mt-0.5">by {song.creator_name || user?.user_metadata?.full_name || "Selah Choir"}</p>
                      <p className="selah-meta mt-0.5">Key of {song.musicKey || chords[0]} · {song.lang}</p>
                    </div>
                    {onLike && (
                      <button
                        id="player-cover-like-btn"
                        onClick={(e) => { e.stopPropagation(); onLike(); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                          isLiked ? "bg-red-500/20 text-red-500 border border-red-500/35" : "bg-black/40 text-gray-300 border border-gray-700/35 hover:text-white"
                        }`}
                        title={isLiked ? "Unlike Song" : "Like Song"}
                      >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}` }}>favorite</span>
                        <span className="text-xs font-bold">{likeCount || 0}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Download row */}
                <div className="p-4 flex gap-2 border-t border-suno-gray-800">
                  {aiAudioUrl ? (
                    <a
                      id="download-full-song-btn"
                      href={aiAudioUrl}
                      download={`${song.title}.mp3`}
                      className="flex-1 selah-btn-secondary text-center text-xs flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Full Song (MP3)
                    </a>
                  ) : (
                    <button
                      id="download-chords-btn"
                      onClick={() => {
                        const text = `${song.title}\n\nChords: ${chords.join(" - ")}\n\n${
                          (song.lyrics || []).map((l) => `[${l.part}] ${l.line}  (${(l.chords || []).join(" ")})`).join("\n")
                        }`;
                        const blob = new Blob([text], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${song.title}-chords.txt`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1 selah-btn-secondary text-xs flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Chords &amp; Lyrics (TXT)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Prompter Lyrics */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              <div className="selah-card rounded-3xl p-6 relative overflow-hidden group flex flex-col justify-between min-h-[350px]">
                <div className="absolute -right-24 -top-24 w-64 h-64 bg-suno-accent/5 blur-[100px] rounded-full group-hover:bg-suno-accent/10 transition-all duration-700"></div>

                <div className="flex items-center justify-between border-b border-suno-gray-800 pb-4 z-10">
                  <span className="selah-body-bold text-suno-accent">Lyrics {playSource && `• Playing from ${playSource}`}</span>
                  <div className="flex items-center gap-2 bg-suno-gray-800 px-3 py-1 rounded-full border border-suno-gray-700">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-gray-655"}`}></span>
                    <span className="selah-meta">{isPlaying ? "Active Playback" : "Idle"}</span>
                  </div>
                </div>

                {/* Lyric Prompter */}
                <div 
                  id="karaoke-lyrics-container" 
                  className="flex-1 overflow-y-auto max-h-[220px] my-4 py-2 px-4 space-y-4 scroll-smooth custom-scrollbar relative z-10 bg-suno-gray-950/45 rounded-2xl border border-suno-gray-850/40"
                >
                  {song.lyrics && song.lyrics.length > 0 ? (
                    song.lyrics.map((l, index) => {
                      const isActive = index === activeLyricIdx;
                      return (
                        <div
                          key={index}
                          id={`lyric-line-${index}`}
                          className={`text-center transition-all duration-300 py-1.5 rounded-xl ${
                            isActive 
                              ? "scale-105 opacity-100 font-extrabold bg-suno-accent/10 text-suno-accent px-4 py-2 shadow-sm border border-suno-accent/20" 
                              : "opacity-40 text-gray-400 font-semibold"
                          }`}
                        >
                          <span className="selah-meta tracking-wider bg-suno-gray-800 border border-suno-gray-750 px-2 py-0.5 rounded-full mr-2">
                            {l.part}
                          </span>
                          <span className="selah-body-bold">
                            {l.line}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 italic text-sm">Press play below to start rehearsal monitor</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Playback Controls */}
              <div className="selah-panel p-6 flex flex-col md:flex-row items-center gap-6 justify-between animate-fadeIn">
                <div className="flex items-center gap-4">
                  <button onClick={handleStop} className="p-4 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-2xl active:scale-95 transition-all text-gray-400 hover:text-white shrink-0" title="Stop Playback">
                    <span className="material-symbols-outlined">stop</span>
                  </button>
                  {onPrev && (
                    <button onClick={onPrev} className="p-4 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-2xl active:scale-95 transition-all text-gray-400 hover:text-white shrink-0" title="Previous Song">
                      <span className="material-symbols-outlined">skip_previous</span>
                    </button>
                  )}
                  <button
                    id="choir-desk-play-btn"
                    onClick={() => (isPlaying ? pause() : play())}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer shrink-0 ${
                      isPlaying ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20" : "bg-suno-accent text-white shadow-suno-accent/20"
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </button>
                  {onNext && (
                    <button onClick={onNext} className="p-4 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-2xl active:scale-95 transition-all text-gray-400 hover:text-white shrink-0" title="Next Song">
                      <span className="material-symbols-outlined">skip_next</span>
                    </button>
                  )}
                  <div className="text-left ml-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Playback</p>
                    <p className="text-sm text-white font-bold">{isPlaying ? "Rehearsal Live" : "Stopped"}</p>
                  </div>
                </div>
                <div className="flex-grow max-w-xs w-full flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tempo</span>
                  <input
                    type="range" min={50} max={160} value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="flex-grow accent-suno-accent h-1 bg-suno-gray-700 rounded-full"
                  />
                  <span className="text-sm font-mono font-bold text-suno-accent w-12 text-right">{bpm}</span>
                </div>
                <button
                  id="simple-view-like-btn"
                  onClick={onLike}
                  className={`px-4 py-3 rounded-full active:scale-95 transition-all border flex items-center gap-1.5 ${
                    isLiked
                      ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/40"
                      : "bg-suno-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-suno-gray-700 hover:border-red-500/30"
                  }`}
                  title={isLiked ? "Unlike this song" : "Like this song"}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                  <span className="text-xs font-bold">{likeCount || 0}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* ADVANCED PRODUCER WORKSTATION VIEW (showAdvanced is TRUE)        */}
        {/* ================================================================ */}
        {showAdvanced && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full animate-fadeIn">
            {mode === "choir" && (
              <>
                {/* Left Column: Prompter Sheet */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  <div className="selah-panel p-6 flex flex-col justify-between min-h-[350px]">
                    <div className="absolute -right-24 -top-24 w-64 h-64 bg-suno-accent/5 blur-[100px] rounded-full group-hover:bg-suno-accent/10 transition-all duration-700"></div>

                    <div className="flex items-center justify-between border-b border-suno-gray-800 pb-4 z-10">
                      <span className="text-xs text-suno-accent font-bold uppercase tracking-widest">Lyrics</span>
                      <div className="flex items-center gap-2 bg-suno-gray-800 px-3 py-1 rounded-full border border-suno-gray-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}></span>
                        <span className="text-xs text-gray-400 font-bold">{isPlaying ? "Active Playback" : "Idle"}</span>
                      </div>
                    </div>

                    {/* Lyric Prompter - Spotify Synced Karaoke Vibe */}
                    <div 
                      id="karaoke-lyrics-container" 
                      className="flex-1 overflow-y-auto max-h-[180px] my-4 py-2 px-4 space-y-4 scroll-smooth custom-scrollbar relative z-10 bg-suno-gray-950/45 rounded-2xl border border-suno-gray-850/40"
                    >
                      {song.lyrics && song.lyrics.length > 0 ? (
                        song.lyrics.map((l, index) => {
                          const isActive = index === activeLyricIdx;
                          return (
                            <div
                              key={index}
                              id={`lyric-line-${index}`}
                              className={`text-center transition-all duration-300 py-1.5 rounded-xl ${
                                isActive 
                                  ? "scale-105 opacity-100 font-extrabold bg-suno-accent/10 text-suno-accent px-4 py-2 shadow-sm border border-suno-accent/20" 
                                  : "opacity-40 text-gray-400 font-semibold"
                              }`}
                            >
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-suno-gray-800 border border-suno-gray-750 px-2 py-0.5 rounded-full mr-2">
                                {l.part}
                              </span>
                              <span className="text-sm md:text-base font-display">
                                {l.line}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 italic text-sm">Press play below to start rehearsal monitor</p>
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
                            const isPercSolo   = song.lyrics[activeLyricIdx].arrangement?.percussion === "solo";
                            const isPercMuted  = song.lyrics[activeLyricIdx].arrangement?.percussion === "mute";
                            const isActive     = inst === "percussion" ? !isPercMuted : !isPercSolo;
                            const icon         = inst === "piano" ? "piano" : inst === "percussion" ? "album" : inst === "bass" ? "music_note" : "tune";
                            return (
                              <span
                                key={inst}
                                className={`material-symbols-outlined text-sm p-1 rounded ${
                                  isActive ? "text-suno-accent bg-suno-accent/10 border border-suno-accent/20" : "text-gray-600 bg-suno-gray-800/40 border border-transparent"
                                }`}
                                title={`${inst.toUpperCase()} — ${isActive ? "Active" : "Inactive"}`}
                              >
                                {icon}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Active Chords Guide */}
                    <div className="border-t border-suno-gray-800 pt-6 z-10">
                      <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-4">Active Chords Guide</p>
                      <div className="flex justify-center flex-wrap gap-3">
                        {(() => {
                          const collapsedChords = [];
                          chords.forEach((chord, index) => {
                            if (collapsedChords.length === 0 || collapsedChords[collapsedChords.length - 1].chord !== chord) {
                              collapsedChords.push({ chord, originalIndices: [index] });
                            } else {
                              collapsedChords[collapsedChords.length - 1].originalIndices.push(index);
                            }
                          });
                          return collapsedChords.map(({ chord, originalIndices }, i) => {
                            const isActive = isPlaying && originalIndices.includes(currentChordIdx);
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
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="selah-panel p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={handleStop} className="p-4 bg-suno-gray-800 hover:bg-suno-gray-700 rounded-2xl active:scale-95 transition-all text-gray-400 hover:text-white" title="Stop Playback">
                        <span className="material-symbols-outlined">stop</span>
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className={`w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ${
                          isPlaying ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20" : "bg-suno-accent text-white shadow-suno-accent/20"
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
                    <div className="flex-grow max-w-xs w-full flex items-center gap-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tempo</span>
                      <input
                        type="range" min={50} max={160} value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="flex-grow accent-suno-accent h-1 bg-suno-gray-700 rounded-full"
                      />
                      <span className="text-sm font-mono font-bold text-suno-accent w-12 text-right">{bpm}</span>
                    </div>
                  </div>

                  {/* Downloads */}
                  <div className="selah-card p-6">
                    <h3 className="selah-title-sm mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-suno-accent text-lg">download</span>
                      Downloads
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button id="download-wav-btn" onClick={exportWav} className="selah-btn-secondary p-4 rounded-2xl">
                          <span className="material-symbols-outlined text-lg">music_note</span>
                          Full Song (WAV)
                        </button>
                        <button id="download-midi-btn" onClick={exportMidi} className="selah-btn-secondary p-4 rounded-2xl">
                          <span className="material-symbols-outlined text-lg">piano</span>
                          MIDI Pack
                        </button>
                      </div>
                      <button
                        id="download-stems-zip-btn"
                        onClick={handleDownloadStemsZip}
                        disabled={downloadingStemsZip}
                        className="selah-btn-primary bg-suno-accent/15 hover:bg-suno-accent/25 border border-suno-accent/30 text-suno-accent w-full p-4 disabled:opacity-50 disabled:cursor-wait"
                      >
                        {downloadingStemsZip ? (
                          <>
                            <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                            Packaging Stems Zip...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-lg">folder_zip</span>
                            Download Multitrack Stems (.zip)
                          </>
                        )}
                      </button>
                      {stemsZipError && (
                        <p className="selah-meta text-red-400 mt-2 text-center bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
                          {stemsZipError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Audio Mixer */}
                <div className="lg:col-span-5 flex flex-col space-y-6">
                  <div className="selah-card p-6">

                    {/* AI Full Mix panel — shown when Suno generation is active */}
                    {isAiMixActive ? (
                      <>
                        <h3 className="selah-title-md mb-1 flex items-center gap-2">
                          <span className="material-symbols-outlined text-suno-accent">auto_awesome</span>
                          AI Full Mix (Suno)
                        </h3>
                        <p className="selah-meta text-gray-500 mb-4 uppercase tracking-wider">
                          Full composed song — vocals &amp; instruments blended by AI
                        </p>

                        {/* Track title */}
                        {aiAudioTitle && (
                          <p className="selah-body-bold mb-3 truncate text-left">
                            &ldquo;{aiAudioTitle}&rdquo;
                          </p>
                        )}

                        {/* Full Mix StemRow (single channel) */}
                        <StemRow
                          label="Full Mix (Cloud)"
                          color="#23D45E"
                          vol={stemState.lead.vol}
                          setVol={(v) => updateStem("lead", "vol", v)}
                          solo={false}
                          setSolo={() => {}}
                          muted={stemState.lead.muted}
                          setMuted={(v) => updateStem("lead", "muted", v)}
                          url={aiAudioUrl}
                          isPlaying={isPlaying}
                        />

                        {/* Track picker — Suno gives 2 variants for free */}
                        {aiTracks && aiTracks.length > 1 && (
                          <div className="mt-4">
                            <p className="text-[10px] text-gray-550 uppercase tracking-widest mb-2 text-left">
                              Suno generated 2 versions — pick your favourite:
                            </p>
                            <div className="flex gap-2">
                              {aiTracks.map((track, idx) => (
                                <button
                                  key={idx}
                                  id={`track-picker-${idx}`}
                                  onClick={() => handleSelectTrack(idx)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                                    selectedTrackIdx === idx
                                      ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                                      : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:text-white hover:border-suno-gray-650"
                                  }`}
                                >
                                  Version {idx + 1}
                                  {track.duration_sec && (
                                    <span className="ml-1 text-[9px] opacity-60">
                                      {Math.round(track.duration_sec)}s
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="w-full mt-5 py-4 rounded-2xl font-bold text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          AI Song Ready — Press Play
                        </div>

                        {/* Re-generate button */}
                        {isOwner && (
                          <button
                            id="regenerate-ai-song-btn"
                            onClick={generateCloudStems}
                            disabled={isGeneratingStems || isSynthesizingLocal}
                            className="w-full mt-3 py-3 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:text-white hover:border-suno-gray-600"
                          >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            Generate New Version (uses 1 credit)
                          </button>
                        )}
                        {/* Back to chords */}
                        <button
                          id="switch-to-chords-btn"
                          onClick={() => { setAiAudioUrl(null); setAiSource(null); setAiTracks(null); }}
                          className="w-full mt-2 py-2.5 rounded-2xl text-xs font-bold border border-suno-gray-700 bg-suno-gray-800 text-gray-400 hover:text-white hover:border-suno-gray-600 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          Switch to Chord Playback
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Local SATB synth mixer — shown when no AI mix is active */}
                        <h3 className="text-lg text-white font-bold mb-4 flex items-center gap-2 font-display">
                          <span className="material-symbols-outlined text-suno-accent">equalizer</span>
                          Choir SAT Harmonies
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

                        {stemsLoaded ? (
                          <div className="w-full mt-6 py-4 rounded-2xl font-bold text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Local Harmonies Loaded &amp; Ready
                          </div>
                        ) : stemsLoading ? (
                          <div className="w-full mt-6 py-4 rounded-2xl font-bold text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center gap-2">
                            <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                            Loading Stems into Audio Engine...
                          </div>
                        ) : (
                          <div className="mt-6 space-y-3">
                            {/* Polling Stage Overlay */}
                            {isGeneratingStems && (
                              <div className="p-4 rounded-2xl bg-suno-accent/10 border border-suno-accent/25 text-suno-accent flex flex-col gap-1.5 animate-pulse">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold uppercase tracking-wider">AI Generation Status</span>
                                  <span className="text-xs font-mono font-bold bg-suno-accent/20 px-2 py-0.5 rounded-md">{elapsedTime}s</span>
                                </div>
                                <p className="text-xs text-white/95 leading-relaxed font-semibold">{generationStage}</p>
                              </div>
                            )}

                            {/* AI generation — primary option */}
                            {isOwner && (
                              <button
                                id="generate-ai-song-btn"
                                onClick={generateCloudStems}
                                disabled={isGeneratingStems || isSynthesizingLocal}
                                className={`w-full py-3.5 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all ${
                                  isGeneratingStems
                                    ? "bg-suno-gray-800 border-suno-gray-700 text-gray-500 cursor-wait"
                                    : isSynthesizingLocal
                                    ? "bg-suno-gray-855 border-suno-gray-850 text-gray-650 cursor-not-allowed"
                                    : "bg-suno-accent/10 border-suno-accent/20 text-suno-accent hover:bg-suno-accent/20 hover:border-suno-accent"
                                }`}
                              >
                                {isGeneratingStems ? (
                                  <>
                                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                    Generating AI Song ({elapsedTime}s)...
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                    Generate AI Song (Suno via apiframe)
                                  </>
                                )}
                              </button>
                            )}

                            {/* Local synth — instant fallback */}
                            <button
                              id="generate-local-stems-btn"
                              onClick={generateLocalStems}
                              disabled={isGeneratingStems || isSynthesizingLocal}
                              className={`w-full py-3.5 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all ${
                                isSynthesizingLocal
                                  ? "bg-suno-gray-800 border-suno-gray-700 text-gray-500 cursor-wait"
                                  : isGeneratingStems
                                  ? "bg-suno-gray-850 border-suno-gray-800 text-gray-600 cursor-not-allowed"
                                  : "bg-suno-gray-800 border-suno-gray-700 text-gray-300 hover:bg-suno-gray-750 hover:text-white"
                              }`}
                            >
                              {isSynthesizingLocal ? (
                                <>
                                  <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                  Synthesizing...
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">piano</span>
                                  Instant Local Synth (No Credits)
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Error feedback */}
                    {stemsError && (
                      <div className={`mt-3 p-4 rounded-2xl border text-sm flex items-start gap-3 ${
                        stemsError.type === "setup"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}>
                        <span className="material-symbols-outlined text-lg mt-0.5 shrink-0">
                          {stemsError.type === "setup" ? "info" : stemsError.type === "retry" ? "update" : "error"}
                        </span>
                        <div className="text-left">
                          <p className="font-bold text-xs uppercase tracking-wider mb-1">
                            {stemsError.type === "setup" ? "Fallback Active" : stemsError.type === "retry" ? "Retrying" : "Error"}
                          </p>
                          <p className="text-xs leading-relaxed">{stemsError.message}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {mode === "workstation" && (
              <div className="lg:col-span-12 flex flex-col md:flex-row gap-8 w-full relative">

                {isExpired && (
                  <div className="absolute inset-0 bg-suno-black/80 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center p-6 border border-suno-gray-800 text-center">
                    <span className="material-symbols-outlined text-red-500 text-5xl mb-4">lock</span>
                    <h3 className="text-xl font-bold text-white font-display">Workstation Session Locked</h3>
                    <p className="text-sm text-gray-400 max-w-md mt-2">
                      This song was generated more than 48 hours ago. Dynamic mixing, part editing, and structure modifications are restricted to premium subscribers.
                    </p>
                    <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-full bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform">
                      Return to Dashboard
                    </button>
                  </div>
                )}

                {/* Left: Instrumental Mixer */}
                <div className="w-full md:w-1/3 space-y-6">
                  <div className="selah-panel p-6">
                    <h3 className="text-base text-white font-bold mb-5 flex items-center gap-2 font-display">
                      <span className="material-symbols-outlined text-suno-accent">tune</span>
                      Instrument Mixer
                    </h3>
                    <div className="space-y-6">
                      {Object.keys(volumes).map((inst) => (
                        <div key={inst} className="space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white capitalize">{inst}</span>
                            <span className="text-[10px] font-mono text-suno-accent font-bold">
                              {Math.round(volumes[inst] * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-gray-500 text-lg">
                              {inst === "piano" ? "piano" : inst === "percussion" ? "album" : inst === "bass" ? "music_note" : "tune"}
                            </span>
                            <input
                              type="range" min={0} max={100}
                              value={Math.round(volumes[inst] * 100)}
                              onChange={(e) => setVolume(inst, Number(e.target.value) / 100)}
                              className="flex-grow accent-suno-accent h-1 bg-suno-gray-800 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {(backingTrackLoaded || backingTrackLoading || isOwner) && (
                      <div className="mt-6 border-t border-suno-gray-800 pt-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 text-left">
                          <span className="material-symbols-outlined text-suno-accent text-sm">cloud</span>
                          Cloud AI Backing Track (Replicate)
                        </h4>
                        {backingTrackLoaded ? (
                          <div className="w-full py-3 rounded-2xl font-bold text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Cloud AI Backing Track Active
                          </div>
                        ) : backingTrackLoading ? (
                          <div className="w-full py-3 rounded-2xl font-bold text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center gap-2">
                            <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                            Loading Cloud Backing Track...
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={generateCloudBacking}
                              disabled={isGeneratingBacking}
                              className={`w-full py-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 active:scale-95 transition-all ${
                                isGeneratingBacking
                                  ? "bg-suno-gray-800 border-suno-gray-700 text-gray-500 cursor-wait"
                                  : "bg-suno-accent/10 border-suno-accent/20 text-suno-accent hover:bg-suno-accent/20 hover:border-suno-accent"
                              }`}
                            >
                              {isGeneratingBacking ? (
                                <>
                                  <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                  Generating Cloud Backing Track...
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">music_note</span>
                                  Upgrade to Cloud AI Backing (Replicate)
                                </>
                              )}
                            </button>
                            {backingError && (
                              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-normal">
                                {backingError}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-8 border-t border-suno-gray-800 pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <button onClick={handleStop} className="p-3.5 bg-suno-gray-800 hover:bg-suno-gray-750 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95" title="Stop Playback">
                          <span className="material-symbols-outlined text-base">stop</span>
                        </button>
                        <button onClick={handlePlayPause} className="flex-grow py-3 rounded-xl bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md transition-transform">
                          <span className="material-symbols-outlined text-sm">{isPlaying ? "pause" : "play_arrow"}</span>
                          {isPlaying ? "Pause Rehearsal" : "Play Backing Track"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Structure Editor */}
                <div className="flex-grow space-y-6">
                  <div className="selah-panel p-6">
                    <h3 className="text-base text-white font-bold mb-4 flex items-center gap-2 font-display">
                      <span className="material-symbols-outlined text-suno-accent">edit_note</span>
                      Song Structure Editor
                    </h3>

                    <div className="space-y-2 mb-6 text-left">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                        Global Chords Loop (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={chordsInput}
                        onChange={(e) => handleChordsInputChange(e.target.value)}
                        onBlur={handleChordsInputBlur}
                        disabled={!isOwner}
                        className="selah-input font-mono text-suno-accent py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="e.g. C, F, G, Am"
                      />
                      {chordValidation.errors.length > 0 && (
                        <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-normal flex items-start gap-2">
                          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                          <div>
                            {chordValidation.errors.map((err, idx) => (
                              <p key={idx}>{err}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {chordValidation.warnings.length > 0 && (
                        <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-normal flex items-start gap-2">
                          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">warning</span>
                          <div>
                            {chordValidation.warnings.map((warn, idx) => (
                              <p key={idx}>{warn}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 text-left">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                        Song Parts &amp; Lyrics
                      </label>
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                        {song.lyrics && song.lyrics.map((l, index) => (
                          <div key={index} className="flex gap-3 p-3 bg-suno-gray-850 border border-suno-gray-800 rounded-2xl items-start">
                            <input
                              type="text" value={l.part}
                              onChange={(e) => handleLyricLineChange(index, "part", e.target.value)}
                              disabled={!isOwner}
                              className="w-20 bg-suno-gray-900 border border-suno-gray-750 focus:border-suno-accent rounded-lg px-2.5 py-1.5 text-center text-xs font-bold text-suno-accent focus:outline-none transition-colors disabled:opacity-60"
                              placeholder="Part"
                            />
                            <input
                              type="text" value={l.line}
                              onChange={(e) => handleLyricLineChange(index, "line", e.target.value)}
                              disabled={!isOwner}
                              className="flex-1 bg-suno-gray-900 border border-suno-gray-750 focus:border-suno-accent rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-colors disabled:opacity-60"
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
        )}

        {/* Comments Section — only in simple practice view */}
        {!showAdvanced && (
            <div className="selah-panel space-y-6">
              <div className="flex items-center gap-2 border-b border-suno-gray-800 pb-4">
                <span className="material-symbols-outlined text-suno-accent text-xl font-bold">forum</span>
                <h3 className="font-display text-base md:text-lg text-white font-bold">Comments</h3>
                <span className="text-sm md:text-base text-suno-accent font-extrabold bg-suno-gray-800/85 border border-suno-gray-700 px-3.5 py-1 rounded-full ml-2">
                  {comments ? comments.length : 0}
                </span>
              </div>

              {commentError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{commentError}</span>
                </div>
              )}

              {/* Comment List */}
              {commentsLoading ? (
                <div className="py-8 text-center space-y-2">
                  <span className="animate-spin material-symbols-outlined text-gray-400">progress_activity</span>
                  <p className="text-sm text-gray-400 font-medium">Loading comments...</p>
                </div>
              ) : !comments || comments.length === 0 ? (
                <div className="py-8 text-center text-gray-300 text-base md:text-lg font-bold italic">
                  No comments yet. Be the first to start the conversation!
                </div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {comments.map((comment) => {
                    const authorInitials = comment.author_name
                      ? comment.author_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "SC";

                    return (
                      <div
                        key={comment.id}
                        className="p-4 bg-suno-gray-950 border border-suno-gray-855 rounded-2xl flex items-start gap-4 text-left"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-suno-accent/15 border border-suno-accent/20 flex items-center justify-center shrink-0">
                          {comment.author_avatar ? (
                            <img
                              src={comment.author_avatar}
                              alt={comment.author_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm md:text-base font-extrabold text-suno-accent">{authorInitials || "?"}</span>
                          )}
                        </div>

                        {/* Content details */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm md:text-base font-extrabold text-white truncate">{comment.author_name}</span>
                            <span className="text-sm md:text-base text-gray-300 font-bold shrink-0">
                              {new Date(comment.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm md:text-base text-gray-105 mt-2 leading-relaxed break-words whitespace-pre-wrap font-semibold">
                            {comment.content}
                          </p>

                          {/* Actions line (Likes/Hearts, Delete) */}
                          <div className="flex items-center gap-4 mt-3">
                            <button
                              onClick={() => handleLikeComment && handleLikeComment(comment.id)}
                              className={`flex items-center gap-1 text-sm md:text-base font-extrabold transition-colors cursor-pointer ${
                                comment.user_liked ? "text-red-500 font-extrabold" : "text-gray-400 hover:text-red-400"
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[17px]"
                                style={{ fontVariationSettings: `'FILL' ${comment.user_liked ? 1 : 0}` }}
                              >
                                favorite
                              </span>
                              <span>{comment.likes_count}</span>
                            </button>

                            {user && String(user.id) === String(comment.user_id) && (
                              <button
                                onClick={() => handleDeleteComment && handleDeleteComment(comment.id)}
                                className="text-sm md:text-base text-gray-350 hover:text-rose-400 font-extrabold transition-colors flex items-center gap-1 cursor-pointer ml-auto"
                                title="Delete comment"
                              >
                                <span className="material-symbols-outlined text-[17px]">delete</span>
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comment Form */}
              {user ? (
                <form onSubmit={handlePostComment} className="flex gap-3 pt-4 border-t border-suno-gray-805">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment && setNewComment(e.target.value)}
                    maxLength={1000}
                    placeholder="Share your encouragement or arrangement ideas..."
                    className="flex-grow selah-input rounded-full py-3"
                  />
                  <button
                    type="submit"
                    disabled={!newComment || !newComment.trim()}
                    className="flex items-center justify-center bg-suno-accent hover:bg-suno-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white w-11 h-11 rounded-full shadow-lg active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-suno-gray-955/50 border border-suno-gray-850/60 rounded-2xl text-center text-sm md:text-base font-bold text-gray-305">
                  Please sign in to join the discussion and react to comments.
                </div>
              )}
            </div>
        )}

        {/* Recommended Next Songs */}
        {recommendations && recommendations.length > 0 && (
          <div className="max-w-6xl mx-auto w-full mt-12 pb-16 text-left border-t border-suno-gray-805 pt-8 animate-fadeIn">
            <h3 className="font-display text-base md:text-lg text-white font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-suno-accent">library_music</span>
              Recommended Next Songs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {recommendations.map((recSong) => (
                <div
                  key={recSong.id}
                  onClick={() => {
                    if (stop) stop();
                    router.push(`/song/${recSong.id}`);
                  }}
                  className="group bg-suno-gray-900 border border-suno-gray-800 rounded-xl overflow-hidden hover:border-suno-gray-700 transition-all duration-300 cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-square overflow-hidden bg-suno-gray-800">
                    <img
                      src={recSong.cover_url || COVER_FALLBACKS[String(recSong.title).charCodeAt(0) % COVER_FALLBACKS.length]}
                      alt={recSong.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-white">play_arrow</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-sm text-white truncate font-display">{recSong.title}</h4>
                    <p className="text-xs text-gray-450 mt-1 truncate font-medium">by {recSong.creator_name || "Selah Choir"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
