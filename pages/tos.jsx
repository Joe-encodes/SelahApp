import Head from "next/head";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="bg-suno-black text-white min-h-screen flex flex-col font-sans selection:bg-suno-accent/30 relative overflow-hidden">
      <Head>
        <title>Terms of Service — SelahAI</title>
        <meta name="description" content="SelahAI Terms of Service. Review the conditions for using our gospel music co-writer and rehearsal studio." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-suno-accent/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-4xl mx-auto px-6 h-24 flex items-center justify-between z-10 relative">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
            <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif text-base tracking-[0.25em] uppercase text-white font-medium mt-0.5">Selah</span>
        </Link>
        <Link href="/app" className="text-xs font-extrabold uppercase tracking-widest text-suno-accent hover:underline">
          Launch App →
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 z-10 relative">
        <h1 className="font-serif text-3xl sm:text-5xl font-light tracking-wide text-white mb-4">
          Terms of <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-suno-accent to-rose-400">Service</span>
        </h1>
        <p className="text-xs text-gray-500 mb-8 uppercase tracking-widest font-semibold">Last updated: June 2026</p>

        <div className="space-y-8 text-sm text-gray-400 leading-relaxed font-medium">
          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">1. Agreement to Terms</h2>
            <p>
              By accessing or using SelahAI, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">2. Account Registration</h2>
            <p>
              To use certain features, you must register for an account using Supabase Auth. You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">3. AI Services &amp; Generation</h2>
            <p>
              SelahAI provides tools to co-write, arrange, and generate song assets using artificial intelligence. You retain ownership of the lyric ideas you input, but the generated audio stems and composition assets are subject to the beta generation limits and community guidelines.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">4. Acceptable Use</h2>
            <p>
              You agree not to use the service to generate hate speech, offensive content, or violate any copyright laws. We reserve the right to remove any public songs or comments that violate our community standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">5. Limitation of Liability</h2>
            <p>
              SelahAI is provided on an &ldquo;as is&rdquo; basis. We make no guarantees regarding service uptime, audio generation speed, or the persistence of your saved data.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-suno-gray-850 py-8 bg-suno-black z-10 relative mt-20">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between gap-4 text-xs text-gray-650">
          <p>© {new Date().getFullYear()} Selah. All rights reserved.</p>
          <Link href="/" className="hover:text-white transition-colors">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
