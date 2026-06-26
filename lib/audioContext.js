import { createContext, useContext, useState, useEffect } from "react";
import { useGospelAudio } from "./useGospelAudio";

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [activeSong, setActiveSong] = useState(null);
  const [playQueue, setPlayQueue] = useState([]);
  const [playSource, setPlaySource] = useState("");

  // Restore active song and queue from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("selah_active_song");
      if (stored) setActiveSong(JSON.parse(stored));
      const storedQueue = sessionStorage.getItem("selah_play_queue");
      if (storedQueue) setPlayQueue(JSON.parse(storedQueue));
      const storedSource = sessionStorage.getItem("selah_play_source");
      if (storedSource) setPlaySource(storedSource);
    } catch { /* ignore */ }
  }, []);

  // Persist active song, queue, and source
  useEffect(() => {
    try {
      if (activeSong) sessionStorage.setItem("selah_active_song", JSON.stringify(activeSong));
      else sessionStorage.removeItem("selah_active_song");
    } catch { /* ignore */ }
  }, [activeSong]);

  useEffect(() => {
    try {
      if (playQueue.length > 0) sessionStorage.setItem("selah_play_queue", JSON.stringify(playQueue));
      else sessionStorage.removeItem("selah_play_queue");
    } catch { /* ignore */ }
  }, [playQueue]);

  useEffect(() => {
    try {
      if (playSource) sessionStorage.setItem("selah_play_source", playSource);
      else sessionStorage.removeItem("selah_play_source");
    } catch { /* ignore */ }
  }, [playSource]);

  const handleNext = () => {
    if (!activeSong || playQueue.length === 0) return;
    const idx = playQueue.findIndex((s) => String(s.id) === String(activeSong.id));
    if (idx === -1) return;
    const nextIdx = (idx + 1) % playQueue.length;
    setActiveSong(playQueue[nextIdx]);
  };

  const handlePrev = () => {
    if (!activeSong || playQueue.length === 0) return;
    const idx = playQueue.findIndex((s) => String(s.id) === String(activeSong.id));
    if (idx === -1) return;
    const prevIdx = (idx - 1 + playQueue.length) % playQueue.length;
    setActiveSong(playQueue[prevIdx]);
  };

  const chords = activeSong?.chords?.length > 0 ? activeSong.chords : ["C", "F", "G", "Am"];
  const genre = activeSong?.genre || "Contemporary";
  const lyrics = activeSong?.lyrics || [];

  const audioState = useGospelAudio(chords, genre, lyrics);

  const { loadBackingTrack, clearBackingTrack } = audioState;

  // Sync active song's backing track into audio engine
  useEffect(() => {
    if (activeSong?.audio_url) {
      loadBackingTrack(activeSong.audio_url);
    } else if (clearBackingTrack) {
      clearBackingTrack();
    }
  }, [activeSong?.audio_url, loadBackingTrack, clearBackingTrack]);

  return (
    <AudioContext.Provider value={{
      activeSong,
      setActiveSong,
      audioState,
      playQueue,
      setPlayQueue,
      playSource,
      setPlaySource,
      handleNext,
      handlePrev
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioContext() {
  const ctx = useContext(AudioContext);
  assert(ctx !== null, "useAudioContext must be used inside <AudioProvider>");
  return ctx;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
