import { useState } from "react";
import { THEMES, LANGS, GENRES, KEYS } from "../../data/constants";

export const CreateTab = ({ onGenerate }) => {
  const [theme, setTheme] = useState("Thanksgiving");
  const [musicKey, setMusicKey] = useState("G");
  const [langs, setLangs] = useState(["English"]);
  const [genre, setGenre] = useState("Afrobeats");
  const [harmony, setHarmony] = useState("sat");
  const [scripture, setScripture] = useState("");
  const [isAutoEnhance, setIsAutoEnhance] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleLang = (l) =>
    setLangs((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );

  return (
    <div className="space-y-8 w-full">
      {/* Title */}
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-white font-bold leading-tight">
          Create Studio
        </h2>
        <p className="text-sm text-on-surface-variant mt-1.5">
          Describe the theme, language, and genre vibe. Our AI will handle the songwriting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full">
        {/* Left Side: Parameters Form */}
        <div className="md:col-span-8 space-y-6">
          <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 md:p-8 rounded-3xl relative overflow-hidden group space-y-6">
            {/* Prompt input styled section */}
            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  Theme / Doctrine Focus
                </label>
              </div>

              {/* Theme selection chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                      theme === t
                        ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                        : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="pt-2 z-10 relative border-t border-suno-gray-800/40">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors py-2 px-1 focus:outline-none"
                type="button"
              >
                <span 
                  className="material-symbols-outlined text-lg transition-transform duration-200" 
                  style={{ transform: showAdvanced ? "rotate(90deg)" : "none" }}
                >
                  chevron_right
                </span>
                <span>{showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}</span>
              </button>
            </div>

            {/* Collapsible Advanced Folder */}
            {showAdvanced && (
              <div className="space-y-6 pt-4 border-t border-suno-gray-800/60 z-10 relative">
                {/* Language Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block">
                    Languages (Code-Switching)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LANGS.map((l) => {
                      const isSelected = langs.includes(l);
                      return (
                        <button
                          key={l}
                          onClick={() => toggleLang(l)}
                          className={`px-4 py-2 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                            isSelected
                              ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                              : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600 hover:text-white"
                          }`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Key Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block">
                    Target Musical Key
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {KEYS.map((k) => (
                      <button
                        key={k}
                        onClick={() => setMusicKey(k)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center justify-center ${
                          musicKey === k
                            ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                            : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600 hover:text-white"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Harmony Structure Options */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block">
                    Harmony Arrangement
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: "solo", label: "Solo Worship Leader" },
                      { val: "sat", label: "Multipart Choir (S.A.T.)" },
                    ].map((o) => (
                      <button
                        key={o.val}
                        onClick={() => setHarmony(o.val)}
                        className={`p-4 rounded-2xl border text-xs font-bold text-left transition-all active:scale-95 ${
                          harmony === o.val
                            ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                            : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:border-suno-gray-600"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scriptural Anchor */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block">
                    Scriptural Anchor (Optional)
                  </label>
                  <input
                    value={scripture}
                    onChange={(e) => setScripture(e.target.value)}
                    placeholder="e.g. Psalm 100:4, Romans 8:31"
                    className="w-full bg-suno-gray-800 border border-suno-gray-700 focus:border-suno-accent focus:ring-1 focus:ring-suno-accent rounded-2xl p-4 text-sm text-white placeholder:text-gray-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={() => onGenerate({ theme, musicKey, langs, genre, harmony, scripture })}
                className="flex items-center gap-2 bg-suno-accent hover:bg-suno-accent/90 text-white px-5 py-3 rounded-full font-bold text-xs md:text-sm shadow-md active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <span>Generate New Song</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Genre Selection */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-suno-gray-900 border border-suno-gray-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base text-white font-bold mb-4 flex items-center gap-2 font-display">
              <span className="material-symbols-outlined text-suno-accent">audiotrack</span>
              Genre Vibe Presets
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              {GENRES.map((g) => {
                const isSelected = genre === g.label;
                return (
                  <button
                    key={g.label}
                    onClick={() => setGenre(g.label)}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-300 active:scale-95 w-full ${
                      isSelected
                        ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                        : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:border-suno-gray-600 hover:text-white"
                    }`}
                  >
                    <span className="text-2xl select-none">{g.icon}</span>
                    <div className="flex-grow">
                      <p className={`text-xs font-bold ${isSelected ? "text-white" : "text-gray-300"}`}>{g.label}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
                        Select Beat & Rhythm
                      </p>
                    </div>
                    <div className="ml-auto flex items-center justify-center text-gray-500">
                      <span className={`material-symbols-outlined text-lg ${isSelected ? "text-suno-accent" : ""}`}>
                        {isSelected ? "radio_button_checked" : "radio_button_unchecked"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
