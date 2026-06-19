import { useState, useEffect } from "react";

export const GeneratingModal = ({ visible }) => {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xl flex items-center justify-center z-[150] px-4 animate-fadeIn">
      <div className="bg-suno-gray-900/90 border border-suno-gray-800 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {/* Decorative ambient color glow inside modal panel */}
        <div className="absolute -left-12 -top-12 w-24 h-24 bg-suno-accent/10 blur-2xl rounded-full"></div>
        <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full"></div>
        
        {/* Equalizer Waveform Animation */}
        <div className="flex items-end gap-1.5 h-12 mb-6">
          <span className="w-1 bg-suno-accent rounded-full animate-[pulse_0.6s_infinite_alternate] h-8"></span>
          <span className="w-1 bg-indigo-500 rounded-full animate-[pulse_0.8s_infinite_alternate] h-11"></span>
          <span className="w-1 bg-purple-500 rounded-full animate-[pulse_0.5s_infinite_alternate] h-6"></span>
          <span className="w-1 bg-suno-accent rounded-full animate-[pulse_0.7s_infinite_alternate] h-12"></span>
          <span className="w-1 bg-indigo-500 rounded-full animate-[pulse_0.9s_infinite_alternate] h-5"></span>
        </div>

        <h3 className="text-white font-display text-lg font-bold tracking-tight mb-2">
          Arranging harmonies{".".repeat(dots)}
        </h3>
        <p className="text-xs text-gray-400 font-sans leading-relaxed mb-6">
          Co-writing lyrics and organizing multipart SAT harmonies using Llama-3.3...
        </p>

        {/* Custom Progress Line */}
        <div className="w-full h-1 bg-suno-gray-800 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-suno-accent to-purple-500 w-full rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};
