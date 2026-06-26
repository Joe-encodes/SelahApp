import { useState } from "react";
import { POPULAR_SONGS } from "../../lib/constants/popularSongs";

const COVER_FALLBACKS = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=600",
  "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600",
];

const getSongCover = (title) => COVER_FALLBACKS[String(title).charCodeAt(0) % COVER_FALLBACKS.length];

export const RehearseTab = ({ songs = [], onPlay, onSelectClassic }) => {
  const [filterQuery, setFilterQuery] = useState("");

  const filteredClassics = POPULAR_SONGS.filter((s) =>
    s.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.genre.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleSelectClassic = (song) => {
    onSelectClassic({
      isPreset: true,
      title: song.title,
      genre: song.genre,
      musicKey: song.musicKey,
      theme: song.theme,
      scripture: song.scripture || "",
      lyrics: song.lyrics.map((lineObj) => ({
        part: lineObj.part,
        line: lineObj.line,
        chords: lineObj.chords,
        arrangement: lineObj.arrangement,
      })),
      chords: song.chords,
    });
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto font-sans text-gray-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-suno-gray-800 pb-4">
        <div>
          <h2 className="selah-title-lg">Rehearsal & Practice Room</h2>
          <p className="selah-body mt-1.5">
            Load Christian classics to rehearse, learn parts, and practice harmonies. No credits used.
          </p>
        </div>
        <div className="relative w-full md:w-72 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-550 text-base">search</span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search classics..."
            className="selah-input !pl-10 py-2"
          />
        </div>
      </div>

      {/* Classics Directory */}
      <div className="selah-panel space-y-4">
        <div>
          <h3 className="selah-title-sm text-suno-accent flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">library_music</span>
            Christian Classics Directory
          </h3>
          <p className="selah-body mt-1.5">
            Select a hymn or contemporary piece to open it in the Choir Desk.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredClassics.length === 0 ? (
            <p className="selah-meta italic py-4 col-span-2">No matching songs found.</p>
          ) : (
            filteredClassics.map((song) => (
              <div
                key={song.id}
                onClick={() => handleSelectClassic(song)}
                className="selah-card-interactive p-4 group flex gap-3.5 items-center cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-suno-gray-800">
                  <img src={getSongCover(song.title)} alt={song.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="selah-body-bold group-hover:text-suno-accent transition-colors truncate">
                      {song.title}
                    </span>
                    <span className="material-symbols-outlined text-base text-suno-accent shrink-0">school</span>
                  </div>
                  <p className="selah-body mt-0.5">{song.genre} · Key of {song.musicKey}</p>
                  <p className="selah-meta mt-0.5 line-clamp-1 italic">{song.theme}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
