import { useState } from "react";
import { LANGS, GENRES, KEYS, EMOTIONAL_MODES, INSTRUMENTATION_MODIFIERS, VOCAL_LEADS } from "../../data/constants";

export const CreateTab = ({ onGenerate }) => {
  // Tier 1: Visible by default
  const [theme, setTheme] = useState(""); // This is the "Tell us about your song" prompt input
  const [scripture, setScripture] = useState("");
  const [emotionalMode, setEmotionalMode] = useState("joy_celebration");

  // Tier 2: Advanced Settings (default to undefined)
  const [genre, setGenre] = useState(undefined);
  const [instrumentation, setInstrumentation] = useState(undefined);
  const [vocalGender, setVocalGender] = useState(undefined);
  const [langs, setLangs] = useState(undefined); // undefined means auto-detect (English)
  const [musicKey, setMusicKey] = useState(undefined);
  const [temperature, setTemperature] = useState(undefined);

  const [rawSongText, setRawSongText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleLang = (l) => {
    setLangs((prev) => {
      const current = prev || [];
      if (current.includes(l)) {
        const text = current.filter((x) => x !== l);
        return text.length > 0 ? text : undefined;
      } else {
        return [...current, l];
      }
    });
  };

  const handleGenerate = () => {
    onGenerate({
      theme: theme || undefined,
      musicKey: musicKey || undefined,
      langs: langs || undefined,
      genre: genre || undefined,
      scripture: scripture || undefined,
      rawSongText: rawSongText || undefined,
      emotional_mode: emotionalMode || undefined,
      instrumentation: instrumentation || undefined,
      vocal_gender: vocalGender || undefined,
      temperature: temperature || undefined,
    });
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto font-sans text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-suno-gray-800 pb-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl text-white font-extrabold leading-tight">
            Create Studio
          </h2>
          <p className="text-sm md:text-base text-gray-300 font-bold mt-2">
            Shape the sound from soul to structure. AI writes the song — you direct the vision.
          </p>
        </div>
      </div>
      {/* Normal AI Create Vibe */}
      <div className="selah-panel space-y-6">
        {/* 1. Tell us about your song */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-suno-accent uppercase tracking-widest block">
            Tell us about your song
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            maxLength={1000}
            placeholder="e.g. A testimony of God's faithfulness in hard times, building from a soft piano intro into a full highlife choir celebration..."
            rows={2}
            className="selah-textarea"
          />
          <div className="flex justify-between text-xs text-gray-400 font-semibold">
            <span>Be specific about mood, story, or pacing</span>
            <span>{theme.length}/1000 chars</span>
          </div>
        </div>

        {/* 2. Scripture Anchor */}
        <div className="space-y-2 pt-4 border-t border-suno-gray-800/40">
          <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
            Scriptural Anchor (Optional)
          </label>
          <input
            type="text"
            value={scripture}
            onChange={(e) => setScripture(e.target.value)}
            maxLength={4000}
            placeholder="e.g. Psalm 23:1, Romans 8:28, or write out a custom verse description"
            className="selah-input"
          />
        </div>

        {/* 3. Emotional Mode */}
        <div className="space-y-3 pt-4 border-t border-suno-gray-800/40">
          <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
            Emotional Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EMOTIONAL_MODES.map((e) => (
              <button
                key={e.val}
                id={`mode-${e.val}`}
                onClick={() => setEmotionalMode(e.val)}
                type="button"
                className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                  emotionalMode === e.val
                    ? "bg-suno-accent/15 border-suno-accent/40 shadow-sm"
                    : "bg-suno-gray-800 border-suno-gray-700 hover:border-suno-gray-600 hover:bg-suno-gray-800/80"
                }`}
              >
                <span className="text-2xl select-none leading-none">{e.icon}</span>
                <span className={`text-xs font-extrabold leading-snug ${emotionalMode === e.val ? "text-suno-accent" : "text-white"}`}>
                  {e.label}
                </span>
                <span className="text-[10px] text-gray-400 leading-relaxed font-medium line-clamp-2">
                  {e.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Advanced Settings Toggle */}
        <div className="pt-2 border-t border-suno-gray-800/40">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 text-sm font-extrabold transition-all py-2 px-3 rounded-xl focus:outline-none cursor-pointer border ${
              showAdvanced
                ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                : "bg-transparent border-transparent text-gray-400 hover:text-white"
            }`}
            type="button"
          >
            <span
              className="material-symbols-outlined text-xl transition-transform duration-200"
              style={{ transform: showAdvanced ? "rotate(90deg)" : "none" }}
            >
              {showAdvanced ? "tune" : "tune"}
            </span>
            <span>{showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings (Optional)"}</span>
          </button>
        </div>

        {/* 6. Advanced Settings Collapsible */}
        {showAdvanced && (
          <div className="space-y-6 pt-4 border-t border-suno-gray-850 animate-fadeIn">
            {/* Genre Presets */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Genre Vibe Preset
                </label>
                {genre !== undefined && (
                  <button
                    onClick={() => setGenre(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GENRES.map((g) => {
                  const isSelected = genre === g.label;
                  return (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setGenre(g.label)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                          : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:border-suno-gray-600"
                      }`}
                    >
                      <span className="text-2xl select-none flex-shrink-0">{g.icon}</span>
                      <div className="flex-grow min-w-0">
                        <p className={`text-sm md:text-base font-extrabold truncate ${isSelected ? "text-white" : "text-gray-300"}`}>
                          {g.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {genre === undefined && (
                <p className="text-sm text-gray-400 font-bold italic">Auto-detecting optimal genre preset based on prompt.</p>
              )}
            </div>

            {/* Instrumentation */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Instrumentation setup
                </label>
                {instrumentation !== undefined && (
                  <button
                    onClick={() => setInstrumentation(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INSTRUMENTATION_MODIFIERS.map((c) => (
                  <button
                    key={c.val}
                    type="button"
                    onClick={() => setInstrumentation(c.val)}
                    className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
                      instrumentation === c.val
                        ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                        : "bg-suno-gray-800 border-suno-gray-700 text-gray-400 hover:border-suno-gray-600"
                    }`}
                  >
                    <p className={`text-sm md:text-base font-extrabold flex items-center gap-2 ${instrumentation === c.val ? "text-white" : "text-gray-350"}`}>
                      <span className="text-lg select-none">{c.icon}</span>
                      {c.label}
                    </p>
                  </button>
                ))}
              </div>
              {instrumentation === undefined && (
                <p className="text-sm text-gray-400 font-bold italic">Auto-detecting optimal instruments from your prompt description.</p>
              )}
            </div>

            {/* Vocal Lead */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Vocal Lead Gender
                </label>
                {vocalGender !== undefined && (
                  <button
                    onClick={() => setVocalGender(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {VOCAL_LEADS.map((v) => (
                  <button
                    key={v.val}
                    type="button"
                    onClick={() => setVocalGender(v.val)}
                    className={`px-4 py-2.5 rounded-full text-sm md:text-base font-extrabold border flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
                      vocalGender === v.val
                        ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                        : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600"
                    }`}
                  >
                    <span className="select-none text-base">{v.icon}</span>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Key */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Target Musical Key
                </label>
                {musicKey !== undefined && (
                  <button
                    onClick={() => setMusicKey(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMusicKey(k)}
                    className={`w-10 h-10 rounded-xl text-sm md:text-base font-extrabold border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                      musicKey === k
                        ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent font-extrabold text-white"
                        : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Languages
                </label>
                {langs !== undefined && (
                  <button
                    onClick={() => setLangs(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto (English)
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => {
                  const isSelected = langs && langs.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLang(l)}
                      className={`px-4 py-2.5 rounded-full text-sm md:text-base font-extrabold border transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? "bg-suno-accent/15 border-suno-accent/30 text-suno-accent"
                          : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600"
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Creative Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-gray-200 uppercase tracking-widest block">
                  Arrangement Style (Structured vs Creative)
                </label>
                {temperature !== undefined && (
                  <button
                    onClick={() => setTemperature(undefined)}
                    className="text-sm font-extrabold text-suno-accent hover:underline cursor-pointer"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm md:text-base text-gray-400 font-bold">Structured</span>
                <input
                  type="range"
                  min="0.3"
                  max="1.2"
                  step="0.05"
                  value={temperature !== undefined ? temperature : 0.75}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="flex-grow accent-suno-accent h-1 bg-suno-gray-850 rounded-lg cursor-pointer"
                />
                <span className="text-sm md:text-base text-gray-400 font-bold">Creative</span>
              </div>
              <p className="text-sm md:text-base text-gray-300 font-bold leading-relaxed mt-1">
                Value: {temperature !== undefined ? `${temperature} (Custom)` : "0.75 (Auto)"}. Lower values guarantee formal chord progressions; higher values allow creative expression.
              </p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex justify-end pt-4 border-t border-suno-gray-800/40">
          <button
            id="generate-song-btn"
            onClick={handleGenerate}
            disabled={!theme && !rawSongText}
            className="flex items-center gap-2 selah-btn-primary py-3.5 text-sm"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            <span>Generate Gospel Song</span>
          </button>
        </div>
      </div>
    </div>
  );
};
