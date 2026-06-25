import { useState, useEffect } from "react";
import { getPublicSongs, toggleLike, getUser } from "../../lib/songService";

const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
];

const getCover = (song) => COVER_FALLBACKS[String(song.title).charCodeAt(0) % COVER_FALLBACKS.length];

const SUPABASE_READY =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";

export const CommunityTab = ({ onPlay }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState(new Set());
  const [likeCounts, setLikeCounts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getUser().then(setCurrentUser);
    if (!SUPABASE_READY) {
      setLoading(false);
      return;
    }
    getPublicSongs().then((data) => {
      setSongs(data);
      const initialCounts = {};
      data.forEach((s) => {
        initialCounts[s.id] = s.like_count ?? 0;
      });
      setLikeCounts(initialCounts);
      setLoading(false);
    });
  }, []);

  const handleLike = async (e, song) => {
    e.stopPropagation();
    if (!currentUser) return;
    const wasLiked = likedIds.has(song.id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(song.id) : next.add(song.id);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [song.id]: Math.max(0, (prev[song.id] ?? 0) + (wasLiked ? -1 : 1)),
    }));
    await toggleLike(song.supabase_id ?? song.id);
  };

  const handleShare = async (e, song) => {
    e.stopPropagation();
    const url = `${window.location.origin}/song/${song.id}`;
    const shareText = `🎵 "${song.title}" — a gospel arrangement on Selah`;
    if (navigator.share) {
      await navigator.share({ title: song.title, text: shareText, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (!SUPABASE_READY) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="selah-title-lg">Community Feed</h2>
          <p className="selah-body mt-1.5">Discover what the global gospel choir is creating.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-suno-accent mb-4 font-bold">groups</span>
          <h3 className="selah-title-md mb-2">Connect to the Feed</h3>
          <p className="selah-body max-w-md leading-relaxed">
            Add your Supabase keys to <code className="text-suno-accent bg-suno-gray-800 px-1.5 py-0.5 rounded">.env.local</code> and run the schema SQL to unlock the Explore feed — see songs from the global Selah choir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="selah-title-lg">Community Feed</h2>
        <p className="selah-body mt-1.5">Gospel arrangements shared by the Selah community.</p>
      </div>

      {!currentUser && (
        <div className="p-4 rounded-2xl bg-suno-accent/10 border border-suno-accent/20 text-suno-accent text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-lg shrink-0">info</span>
          <span className="selah-body-bold text-suno-accent">Sign in to like songs and share your own arrangements with the community.</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="selah-card animate-pulse">
              <div className="aspect-square bg-suno-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-suno-gray-800 rounded w-3/4" />
                <div className="h-3 bg-suno-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-700 mb-4">queue_music</span>
          <p className="selah-body">No public songs yet. Be the first to publish one from your Library!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {songs.map((song) => {
            const isLiked = likedIds.has(song.id);
            return (
              <div
                key={song.id}
                onClick={() => onPlay && onPlay(song)}
                className="selah-card-interactive group flex flex-col"
              >
                <div className="relative aspect-square overflow-hidden bg-suno-gray-800">
                  <img
                    src={getCover(song)}
                    alt={song.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      className="w-12 h-12 bg-suno-accent rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onPlay && onPlay(song); }}
                    >
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    </button>
                  </div>
                  <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      id={`community-share-${song.id}`}
                      onClick={(e) => handleShare(e, song)}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:text-suno-accent transition-colors cursor-pointer"
                      title="Share this song"
                    >
                      <span className="material-symbols-outlined text-sm">share</span>
                    </button>
                    <button
                      id={`community-like-${song.id}`}
                      onClick={(e) => handleLike(e, song)}
                      className={`p-2 bg-black/60 backdrop-blur-md rounded-full transition-colors cursor-pointer ${isLiked ? "text-red-500" : "text-white hover:text-red-400"}`}
                      title={isLiked ? "Unlike" : "Like"}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}` }}>favorite</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="selah-body-bold truncate">{song.title}</h3>
                    <p className="selah-meta mt-1 truncate">by {song.creator_name || "Selah Choir"}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto font-bold">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                      <span>{likeCounts[song.id] ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
