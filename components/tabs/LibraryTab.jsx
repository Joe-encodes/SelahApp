import { useState } from "react";

const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
];

const getSongCover = (song) => {
  return COVER_FALLBACKS[String(song.title).charCodeAt(0) % COVER_FALLBACKS.length];
};

export const LibraryTab = ({ songs, songsLoaded, onPlay, onQuickPlay, activeSongId, user, profile }) => {
  const [likedSongs, setLikedSongs] = useState({});

  const toggleLike = (e, id) => {
    e.stopPropagation();
    setLikedSongs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (e, song) => {
    e.stopPropagation();
    const url = `${window.location.origin}/song/${song.id}`;
    if (navigator.share) {
      await navigator.share({ title: song.title, text: `🎵 "${song.title}" on Selah`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  };

  // Only show songs the user owns or that are public, and are not expired (>48h old)
  const visibleSongs = songs.filter((s) => {
    if (s.created_at && (Date.now() - s.created_at) > 48 * 60 * 60 * 1000) return false;
    if (s.is_public) return true;
    if (user && String(s.user_id) === String(user.id)) return true;
    return false;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="selah-title-lg">Your Library</h2>
        <p className="selah-body mt-1.5">Browse and practice your saved gospel arrangements.</p>
      </div>

      {!songsLoaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="selah-card animate-pulse">
              <div className="aspect-square bg-suno-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-suno-gray-800 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleSongs.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-5xl text-gray-700 mb-4 font-bold">library_music</span>
          <p className="selah-body-bold text-base">No songs yet.</p>
          <p className="selah-body mt-1">Generate your first song in Create Studio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleSongs.map((song) => {
            const isLiked = !!likedSongs[song.id];
            const isActive = activeSongId === song.id;
            return (
              <div
                key={song.id}
                onClick={() => onPlay(song)}
                className={`group flex flex-col ${
                  isActive ? "selah-card-interactive border-suno-accent/50 shadow-[0_0_16px_rgba(35,212,94,0.15)] border-suno-accent/70" : "selah-card-interactive"
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-suno-gray-800">
                  <img
                    src={getSongCover(song)}
                    alt={song.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Play button overlay — quick play plays in bottom bar */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      id={`lib-quick-play-${song.id}`}
                      className="w-12 h-12 bg-suno-accent rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onQuickPlay(song); }}
                      title="Play"
                    >
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isActive ? "pause" : "play_arrow"}
                      </span>
                    </button>
                  </div>
                  {/* Heart + Share overlay */}
                  <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      id={`lib-share-btn-${song.id}`}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:text-suno-accent transition-colors cursor-pointer"
                      onClick={(e) => handleShare(e, song)}
                      title="Share"
                    >
                      <span className="material-symbols-outlined text-sm">share</span>
                    </button>
                    <button
                      id={`lib-like-btn-${song.id}`}
                      className={`p-2 bg-black/60 backdrop-blur-md rounded-full transition-colors cursor-pointer ${isLiked ? "text-red-500" : "text-white hover:text-red-400"}`}
                      onClick={(e) => toggleLike(e, song.id)}
                      title={isLiked ? "Unlike" : "Like"}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}` }}>favorite</span>
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="selah-body-bold truncate">{song.title}</h3>
                  <p className="selah-meta mt-1 truncate">by {song.creator_name || "Selah Choir"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
