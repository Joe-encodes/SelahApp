import { useState, useEffect } from "react";
import { GENRES } from "../../data/constants";
import { getPublicSongs, toggleLike, getUser } from "../../lib/songService";

const COVER_IMAGES = {
  1: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600",
  2: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=600",
  3: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600",
};

const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
];

const FEATURED_IMAGES = [
  "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200",
  "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1200",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200",
];

const getSongCover = (song) => {
  if (COVER_IMAGES[song.id]) return COVER_IMAGES[song.id];
  return COVER_FALLBACKS[String(song.title).charCodeAt(0) % COVER_FALLBACKS.length];
};

const SUPABASE_READY =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";

const SongCardSkeleton = () => (
  <div className="selah-card animate-pulse">
    <div className="aspect-square bg-suno-gray-800" />
    <div className="p-4 space-y-2">
      <div className="h-4 bg-suno-gray-800 rounded w-3/4" />
    </div>
  </div>
);

export const HomeTab = ({ songs, songsLoaded, onPlay, onQuickPlay, onCreateFirst, activeSongId, isPlaying, profile, user, selectedGenre, onSelectGenre, isFiltered }) => {
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // Public community songs with real likes
  const [publicSongs, setPublicSongs] = useState([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [likedIds, setLikedIds] = useState(new Set());
  const [likeCounts, setLikeCounts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  const featuredSongs = songs.slice(0, 3);
  const featuredSong = featuredSongs[featuredIdx];

  useEffect(() => {
    if (!SUPABASE_READY) { setPublicLoading(false); return; }
    getUser().then(setCurrentUser);
    getPublicSongs().then((data) => {
      setPublicSongs(data);
      const counts = {};
      data.forEach((s) => { counts[s.id] = s.like_count ?? 0; });
      setLikeCounts(counts);
      setPublicLoading(false);
    }).catch(() => setPublicLoading(false));
  }, []);

  useEffect(() => {
    if (featuredSongs.length <= 1) return;
    const timer = setInterval(() => {
      setFeaturedIdx((prev) => (prev + 1) % featuredSongs.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredSongs.length]);

  const handleNextFeatured = (e) => {
    e.stopPropagation();
    setFeaturedIdx((prev) => (prev + 1) % featuredSongs.length);
  };

  const handlePrevFeatured = (e) => {
    e.stopPropagation();
    setFeaturedIdx((prev) => (prev - 1 + featuredSongs.length) % featuredSongs.length);
  };

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
    if (navigator.share) {
      await navigator.share({ title: song.title, text: `🎵 "${song.title}" on Selah`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  };

  const getGreetingName = () => {
    const raw = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
    if (!raw) return "Choir Director";
    return raw.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  // Choose which songs to show in the grid: filtered user songs, or public community feed
  const displaySongs = (SUPABASE_READY && !isFiltered && songs.length === 0 && !publicLoading)
    ? publicSongs
    : songs;
  const usingPublicFeed = SUPABASE_READY && displaySongs === publicSongs;

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div>
        <h2 className="selah-title-lg">Welcome back, {getGreetingName()} 👋</h2>
        <p className="selah-body mt-1.5">
          Ready to arrange and practice this Sunday&apos;s worship selections?
        </p>
      </div>

      {/* Featured Banner */}
      {!songsLoaded ? (
        <section>
          <div className="h-96 md:h-[450px] rounded-3xl bg-suno-gray-900 border border-suno-gray-800 animate-pulse" />
        </section>
      ) : featuredSongs.length > 0 ? (
        <section>
          <div
            className="relative h-96 md:h-[450px] rounded-3xl overflow-hidden border border-suno-gray-800 group cursor-pointer"
            onClick={() => onPlay(featuredSong)}
          >
            {featuredSongs.map((song, idx) => {
              const isActive = idx === featuredIdx;
              return (
                <div
                  key={song.id}
                  className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                    isActive ? "opacity-100 translate-x-0 z-10" : "opacity-0 pointer-events-none translate-x-4 z-0"
                  }`}
                >
                  <img
                    src={FEATURED_IMAGES[idx % FEATURED_IMAGES.length]}
                    className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                    alt="Featured"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent p-8 md:p-16 flex flex-col justify-center">
                    <span className="text-suno-accent font-bold tracking-widest uppercase text-xs mb-2">
                      Featured Sunday Arrangement
                    </span>
                    <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 text-white">{song.title}</h2>
                    <p className="text-gray-305 max-w-lg mb-6 leading-relaxed font-sans line-clamp-2 text-sm">
                      Theme: {song.theme} · Scriptural Anchor: {song.scripture} · {song.lang}
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); onPlay(song); }}
                        className="selah-btn-primary bg-white text-black hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all text-sm font-bold"
                      >
                        Listen Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {featuredSongs.length > 1 && (
              <>
                <button
                  id="featured-prev-btn"
                  onClick={handlePrevFeatured}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white z-20 transition-colors"
                  title="Previous song"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button
                  id="featured-next-btn"
                  onClick={handleNextFeatured}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white z-20 transition-colors"
                  title="Next song"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
                <div className="absolute bottom-6 left-8 md:left-16 flex gap-2 z-20">
                  {featuredSongs.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setFeaturedIdx(idx); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === featuredIdx ? "w-8 bg-suno-accent" : "w-3 bg-white/40 hover:bg-white/60"
                      }`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <section>
          <div className="relative rounded-3xl overflow-hidden border border-suno-gray-800 bg-suno-gray-900 p-10 md:p-16 flex flex-col items-center justify-center text-center min-h-[260px]">
            <div className="absolute inset-0 opacity-20">
              <img src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-suno-gray-900 via-suno-gray-900/70 to-transparent" />
            <div className="relative z-10 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl text-suno-accent mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h3 className="selah-title-lg mb-2">Your Choir Has No Songs Yet</h3>
              <p className="selah-body max-w-md mb-6">
                Generate your first AI-powered gospel arrangement. Pick a theme, key, genre, and language — and Groq AI will write it in seconds.
              </p>
              <button id="create-first-song-btn" onClick={onCreateFirst} className="selah-btn-primary">
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Create Your First Song
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Song Grid — user's songs or community public feed */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="selah-title-md">
            {usingPublicFeed ? "Community Discover" : "Recent Arrangements"}
          </h2>
          {usingPublicFeed && !currentUser && (
            <p className="selah-meta">Sign in to like songs</p>
          )}
        </div>

        {!songsLoaded || (usingPublicFeed && publicLoading) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <SongCardSkeleton key={i} />)}
          </div>
        ) : displaySongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {isFiltered ? (
              <>
                <span className="material-symbols-outlined text-4xl text-suno-accent mb-3">search_off</span>
                <p className="selah-body-bold">No songs match your search query.</p>
                <p className="selah-body mt-1 mb-4">Would you like to create a new arrangement for this?</p>
                <button onClick={onCreateFirst} className="selah-btn-primary">
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Create this song
                </button>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-4xl text-gray-700 mb-3">queue_music</span>
                <p className="selah-body">No arrangements yet — generate one in Create Studio.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displaySongs.map((song) => {
              const isActive = activeSongId === song.id;
              const isLiked = likedIds.has(song.id);
              return (
                <div
                  key={song.id}
                  onClick={() => onPlay(song)}
                  className={`group flex flex-col ${
                    isActive ? "selah-card-interactive border-suno-accent/50 shadow-[0_0_16px_rgba(35,212,94,0.15)]" : "selah-card-interactive"
                  }`}
                >
                  <div className="relative aspect-square overflow-hidden bg-suno-gray-800">
                    <img
                      src={getSongCover(song)}
                      alt={song.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 md:bg-black/40 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none md:pointer-events-auto">
                      <button
                        id={`quick-play-${song.id}`}
                        className="w-12 h-12 bg-suno-accent rounded-full flex items-center justify-center text-white md:transform md:translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); onQuickPlay ? onQuickPlay(song) : onPlay(song); }}
                        title="Play"
                      >
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {isActive && isPlaying ? "pause" : "play_arrow"}
                        </span>
                      </button>
                    </div>
                    {/* Share + Like overlay */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        id={`share-${song.id}`}
                        className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:text-suno-accent transition-colors"
                        onClick={(e) => handleShare(e, song)}
                        title="Share"
                      >
                        <span className="material-symbols-outlined text-sm">share</span>
                      </button>
                      <button
                        id={`like-${song.id}`}
                        className={`p-2 bg-black/60 backdrop-blur-md rounded-full transition-colors ${isLiked ? "text-red-500" : "text-white hover:text-red-400"}`}
                        onClick={(e) => handleLike(e, song)}
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
                        <span>{usingPublicFeed ? (likeCounts[song.id] ?? 0) : (song.like_count ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Browse by Genre — bottom */}
      <section className="pb-4">
        <h3 className="selah-title-sm mb-4">Browse by Genre</h3>
        <div className="flex flex-wrap gap-3">
          {GENRES.map((g) => {
            const isSelected = selectedGenre?.toLowerCase() === g.label.toLowerCase();
            return (
              <div
                key={g.label}
                onClick={() => onSelectGenre && onSelectGenre(g.label)}
                className={`flex-1 min-w-[120px] max-w-[200px] p-3 text-center cursor-pointer rounded-2xl border transition-all duration-200 ${
                  isSelected
                    ? "bg-suno-accent/10 border-suno-accent text-suno-accent"
                    : "bg-suno-gray-900 border-suno-gray-800 hover:border-suno-gray-700 hover:bg-suno-gray-800/60"
                }`}
              >
                <div className="text-xl mb-1">{g.icon}</div>
                <div className={`text-[10px] font-semibold truncate ${isSelected ? "text-suno-accent" : "text-gray-400"}`}>{g.label}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
