import { createContext, useContext, useState, useEffect } from "react";
import { useGospelAudio } from "./useGospelAudio";

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [activeSong, setActiveSong] = useState(null);

  // Restore active song from sessionStorage (persistent player across navigation)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("selah_active_song");
      if (stored) setActiveSong(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Persist active song to sessionStorage so it survives page navigation
  useEffect(() => {
    try {
      if (activeSong) sessionStorage.setItem("selah_active_song", JSON.stringify(activeSong));
      else sessionStorage.removeItem("selah_active_song");
    } catch { /* ignore */ }
  }, [activeSong]);

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
    <AudioContext.Provider value={{ activeSong, setActiveSong, audioState }}>
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
