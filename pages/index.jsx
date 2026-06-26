import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();

  const handleScrollToFeatures = () => {
    const el = document.getElementById("features");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const features = [
    {
      icon: "menu_book",
      color: "text-suno-accent",
      title: "Scripture-Based Co-Writing",
      desc: "Input biblical verses to anchor your theme, structure lyrics, and generate gospel compositions built on truth."
    },
    {
      icon: "groups",
      color: "text-rose-400",
      title: "Choir-Focused SATB Stems",
      desc: "Train your sections with separate stems for Soprano, Alto, Tenor, and Bass, muting or soloing parts dynamically."
    },
    {
      icon: "analytics",
      color: "text-emerald-400",
      title: "Chord Disintegration",
      desc: "Deconstruct rich chord progressions and vocal harmonies to analyze composition structure and music theory."
    },
    {
      icon: "tune",
      color: "text-amber-400",
      title: "Worship Pacing & Keys",
      desc: "Instantly change playback tempo (BPM) and transposition keys to match your choir's vocal range and style."
    },
    {
      icon: "forum",
      color: "text-purple-400",
      title: "Community Sharing Feed",
      desc: "Publish your customized arrangements, leave comments, react to feedback, and share with worshippers worldwide."
    },
    {
      icon: "download",
      color: "text-cyan-400",
      title: "DAW & MIDI Exports",
      desc: "Download MIDI outlines and high-fidelity audio backing tracks directly to load into your church projection or DAW software."
    }
  ];

  return (
    <div className="bg-suno-black text-white min-h-screen flex flex-col font-sans selection:bg-suno-accent/30 relative overflow-hidden">
      <Head>
        <title>SelahAI — Gospel Music Co-Writer &amp; Rehearsal Studio</title>
        <meta name="description" content="An AI-powered co-writer for gospel choirs, worship leaders, and composers. Shape the message, structure the harmony, and direct the vision." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Decorative background glow elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-suno-accent/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-rose-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header / Brand Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 h-24 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif text-lg tracking-[0.25em] uppercase text-white font-medium mt-0.5">Selah</span>
        </div>
        <button
          onClick={() => router.push("/app")}
          className="text-xs font-extrabold uppercase tracking-widest text-gray-400 hover:text-white border border-suno-gray-800 hover:border-gray-600 bg-suno-gray-900/30 px-5 py-2.5 rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
        >
          Sign In
        </button>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto z-10 relative min-h-[calc(100vh-6rem)]">
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-wide text-white leading-[1.1] mb-6">
          Shape the Message,<br />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-suno-accent to-rose-400">
            Structure the Harmony
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-gray-400 max-w-2xl leading-relaxed mb-12 font-medium">
          An AI-powered co-writer designed for gospel choirs, worship leaders, and composers. Transcribe scriptures into song ideas, generate multi-vocal arrangements, and lead your rehearsal with custom backing tracks.
        </p>

        <div className="flex flex-col items-center gap-6 w-full">
          <button
            id="cta-enter-app"
            onClick={() => router.push("/app")}
            className="w-full sm:w-auto px-10 py-4.5 bg-white text-black font-extrabold rounded-full transition-all duration-300 hover:bg-gray-100 hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5 cursor-pointer text-sm tracking-wider uppercase"
          >
            Launch Studio
          </button>
          
          <button
            onClick={handleScrollToFeatures}
            className="mt-8 flex flex-col items-center gap-1.5 text-gray-500 hover:text-white transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Learn How It Works</span>
            <span className="material-symbols-outlined text-lg animate-bounce mt-1">expand_more</span>
          </button>
        </div>
      </main>

      {/* Features Anchor Section */}
      <section id="features" className="w-full border-t border-suno-gray-800 bg-suno-gray-950/20 py-24 z-10 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <h2 className="font-serif text-3xl md:text-4xl text-white font-medium">Crafted with Worship Intent</h2>
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">Everything you need to direct your choir and elevate your music ministry.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="p-8 rounded-3xl border border-suno-gray-850 bg-suno-gray-900/10 flex flex-col items-start text-left hover:border-suno-gray-700 transition-all duration-300">
                <span className={`material-symbols-outlined ${feature.color} text-3xl mb-4 font-bold`}>{feature.icon}</span>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white mb-2 font-display">{feature.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-suno-gray-850 py-8 bg-suno-black z-10 relative">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-650">© {new Date().getFullYear()} Selah. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/tos" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
