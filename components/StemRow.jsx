export const StemRow = ({ label, color, vol, setVol, solo, setSolo, muted, setMuted, url }) => {
  return (
    <div
      className={`flex flex-col gap-2.5 p-3.5 rounded-2xl border transition-all duration-300 ${
        url
          ? "bg-suno-gray-900 border-suno-gray-800"
          : "bg-suno-gray-900/50 border-suno-gray-800/50"
      }`}
      style={{ borderColor: url ? `${color}40` : "rgba(30, 30, 30, 0.5)" }}
    >
      {/* Top row: Icon + Label */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none text-black shadow-md font-display"
          style={{ backgroundColor: color }}
        >
          {label[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">{label}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
            {url ? "Synthesizer Ready" : "Inactive / Silent"}
          </p>
        </div>
      </div>

      {/* Bottom row: Slider + Buttons */}
      <div className="flex items-center gap-3 pl-11">
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => setVol(+e.target.value)}
          className="flex-1 accent-suno-accent h-1 bg-suno-gray-800 rounded-full"
        />
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setSolo(!solo)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all active:scale-95 ${
              solo
                ? "bg-suno-accent text-white border-suno-accent shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600 hover:text-white"
            }`}
          >
            SOLO
          </button>
          <button
            onClick={() => setMuted(!muted)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all active:scale-95 ${
              muted
                ? "bg-red-500/20 text-red-500 border-red-500/30"
                : "bg-suno-gray-800 text-gray-400 border-suno-gray-700 hover:border-suno-gray-600 hover:text-white"
            }`}
          >
            MUTE
          </button>
        </div>
      </div>
    </div>
  );
};

