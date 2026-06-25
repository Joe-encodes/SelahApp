import { useRouter } from "next/router";

export const AuthRequiredModal = ({ visible, onClose }) => {
  const router = useRouter();

  if (!visible) return null;

  const handleSignInRedirect = () => {
    onClose();
    router.push(`/auth?next=${encodeURIComponent(router.asPath)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xl flex items-center justify-center z-[150] px-4 animate-fadeIn">
      <div className="selah-panel max-w-sm w-full flex flex-col items-center text-center overflow-hidden">
        {/* Decorative ambient color glow inside modal panel */}
        <div className="absolute -left-12 -top-12 w-24 h-24 bg-suno-accent/10 blur-2xl rounded-full"></div>
        <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full"></div>
        
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-full bg-suno-accent/10 border border-suno-accent/20 flex items-center justify-center mb-5 relative z-10">
          <span className="material-symbols-outlined text-suno-accent text-3xl">lock</span>
        </div>

        <h3 className="text-white font-display text-lg font-bold tracking-tight mb-2 relative z-10">
          Sign In Required
        </h3>
        <p className="text-xs text-gray-400 font-sans leading-relaxed mb-6 relative z-10">
          Please sign in to your Selah account to access our cloud AI co-writing, vocal harmony, and backing track generation services.
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5 w-full relative z-10">
          <button
            onClick={handleSignInRedirect}
            className="selah-btn-primary w-full py-3"
          >
            Sign In / Create Account
          </button>
          <button
            onClick={onClose}
            className="selah-btn-secondary w-full py-3"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
