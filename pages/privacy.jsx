import Head from "next/head";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="bg-suno-black text-white min-h-screen flex flex-col font-sans selection:bg-suno-accent/30 relative overflow-hidden">
      <Head>
        <title>Privacy Policy — SelahAI</title>
        <meta name="description" content="SelahAI Privacy Policy. Learn how we handle and protect your personal information, display names, and generated songs." />
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
          Privacy <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-suno-accent to-rose-400">Policy</span>
        </h1>
        <p className="text-xs text-gray-500 mb-8 uppercase tracking-widest font-semibold">Last updated: June 2026</p>

        <div className="space-y-8 text-sm text-gray-400 leading-relaxed font-medium">
          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">1. Information We Collect</h2>
            <p>
              We collect your email address, display name, and avatar URL via Supabase Auth when you sign in or update your singer credentials. We also save metadata for songs you generate (lyrics, chords, settings) to synchronize your workspace across devices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">2. How We Use Information</h2>
            <p>
              Your personal data is used solely to authenticate your access, track your generation credits, personalize your profile settings, and display authorship for songs you choose to publish on the community feed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">3. Data Sharing &amp; Visibility</h2>
            <p>
              By default, songs generated in Create Studio are private to your account. If you choose to publish a song, its title, chords, lyrics, and your display name will be made readable to other authenticated users on the platform. We never sell your personal data to third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">4. Third-Party Integrations</h2>
            <p>
              SelahAI utilizes Supabase for database hosting and authentication, and external AI partners (Suno/APIFrame) to synthesize backing tracks. Audio generation requests are sent anonymously without exposing your personal identity details.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white text-base font-extrabold uppercase tracking-wider">5. Your Data Rights</h2>
            <p>
              You can delete your saved songs from the local library or cloud database at any time. If you wish to delete your account or wipe your profile data completely, please contact support or delete your account through the Supabase user console.
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
