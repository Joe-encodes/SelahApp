import { useState } from "react";
import { GENRES } from "../../data/constants";

const COVER_IMAGES = {
  1: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600", // Ese O Baba
  2: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=600", // God Grace Wey We No Work For
  3: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600", // Chineke — You Are Faithful
};

const getSongCover = (song) => {
  if (COVER_IMAGES[song.id]) return COVER_IMAGES[song.id];
  const hash = String(song.title).charCodeAt(0) % 5;
  const fallbacks = [
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
    "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
  ];
  return fallbacks[hash];
};

export const HomeTab = ({ songs, onPlay, onCreateFirst }) => {
  const featuredSong = songs[0];
  const [likedSongs, setLikedSongs] = useState({});

  const toggleLike = (e, id) => {
    e.stopPropagation();
    setLikedSongs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-10">
      {/* Welcome Message */}
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-white font-bold leading-tight">
          Welcome back, Choir Director 👋
        </h2>
        <p className="text-sm text-gray-400 mt-1.5 font-sans">
          Ready to arrange and practice this Sunday's worship selections?
        </p>
      </div>

      {/* Featured Banner — only shown when songs exist */}
      {featuredSong ? (
        <section>
          <div className="relative h-64 rounded-3xl overflow-hidden mb-12 border border-suno-gray-800 group cursor-pointer" onClick={() => onPlay(featuredSong)}>
            <img 
              src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60"
              alt="Featured"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent p-8 md:p-12 flex flex-col justify-center">
              <span className="text-suno-accent font-bold tracking-widest uppercase text-sm mb-2">Featured Sunday Arrangement</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 text-white">
                {featuredSong.title}
              </h2>
              <p className="text-gray-300 max-w-lg mb-6 leading-relaxed font-sans line-clamp-2">
                Theme: {featuredSong.theme} · Scriptural Anchor: {featuredSong.scripture} · {featuredSong.lang}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(featuredSong);
                  }}
                  className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-transform text-sm"
                >
                  Listen Now
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Empty state — no songs generated yet */
        <section className="mb-12">
          <div className="relative rounded-3xl overflow-hidden border border-suno-gray-800 bg-suno-gray-900 p-10 md:p-16 flex flex-col items-center justify-center text-center min-h-[260px] group">
            <div className="absolute inset-0 opacity-20">
              <img
                src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200"
                className="w-full h-full object-cover"
                alt=""
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-suno-gray-900 via-suno-gray-900/70 to-transparent" />
            <div className="relative z-10 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl text-suno-accent mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
                Your Choir Has No Songs Yet
              </h3>
              <p className="text-gray-400 text-sm max-w-md mb-6">
                Generate your first AI-powered gospel arrangement. Pick a theme, key, genre, and language — and Groq AI will write it in seconds.
              </p>
              <button
                onClick={onCreateFirst}
                className="px-8 py-3 rounded-full bg-suno-accent hover:bg-suno-accent/90 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Create Your First Song
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Trending / Recent Grid (Suno MusicCard Style) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white">
            Recent Arrangements
          </h2>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-700 mb-3">queue_music</span>
            <p className="text-gray-500 text-sm">No arrangements yet — generate one in Create Studio.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {songs.map((song) => {
            const isLiked = !!likedSongs[song.id];
            const coverUrl = getSongCover(song);

            return (
              <div 
                key={song.id}
                onClick={() => onPlay(song)}
                className="group bg-suno-gray-900 border border-suno-gray-800 rounded-xl overflow-hidden hover:border-suno-gray-700 transition-all duration-300 cursor-pointer flex flex-col"
              >
                {/* Cover Image Wrapper */}
                <div className="relative aspect-square overflow-hidden bg-suno-gray-800">
                  <img 
                    src={coverUrl} 
                    alt={song.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      className="w-12 h-12 bg-suno-accent rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(song);
                      }}
                    >
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                    </button>
                  </div>
                  {/* Heart & Details overlay */}
                  <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className={`p-2 bg-black/60 backdrop-blur-md rounded-full transition-colors ${isLiked ? 'text-red-500' : 'text-white hover:text-red-400'}`}
                      onClick={(e) => toggleLike(e, song.id)}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}` }}>
                        favorite
                      </span>
                    </button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white truncate mb-1 font-display">
                      {song.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm font-medium">Key of {song.musicKey}</span>
                      <span className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]" title={song.scripture}>
                        📖 {song.scripture}
                      </span>
                    </div>
                  </div>
                  
                  {song.genre && (
                    <div className="mt-4 flex gap-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-suno-gray-800 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {song.genre}
                      </span>
                      <span className="px-2 py-0.5 bg-suno-gray-800 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {song.lang}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Browse by Genre */}
      <section>
        <h3 className="font-headline-md text-lg text-white font-bold mb-5 font-display">
          Browse by Genre Vibe
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {GENRES.map((g) => (
            <div
              key={g.label}
              className="rounded-xl bg-suno-gray-900 border border-suno-gray-800 p-5 text-center cursor-pointer hover:border-suno-accent/50 hover:bg-suno-gray-800/50 transition-all duration-300 group"
            >
              <div className="text-3xl mb-2.5 transition-transform duration-300 group-hover:scale-110">{g.icon}</div>
              <div className="text-xs font-bold text-gray-400 truncate group-hover:text-white transition-colors">{g.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
