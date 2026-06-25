import { useState, useEffect } from "react";
import { updateProfile } from "../lib/songService";

export const ProfileModal = ({ visible, onClose, user, profile, onUpdateProfileState }) => {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
    } else if (user) {
      setDisplayName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
      setAvatarUrl(user.user_metadata?.avatar_url || "");
    }
  }, [profile, user]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const updated = await updateProfile(user.id, displayName, avatarUrl);
      if (onUpdateProfileState) {
        onUpdateProfileState(updated);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xl flex items-center justify-center z-[150] px-4 animate-fadeIn">
      <div className="selah-panel max-w-sm w-full flex flex-col overflow-hidden">
        {/* Decorative ambient color glow inside modal panel */}
        <div className="absolute -left-12 -top-12 w-24 h-24 bg-suno-accent/10 blur-2xl rounded-full"></div>
        <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white transition-colors"
          title="Close Settings"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <h3 className="text-white font-display text-lg font-bold tracking-tight mb-1 relative z-10">
          Profile Settings
        </h3>
        <p className="text-xs text-gray-400 font-sans mb-6 relative z-10">
          Update your gospel singer credentials
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10 w-full">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Account Email
            </label>
            <input
              type="text"
              value={user?.email || ""}
              disabled
              className="w-full bg-suno-gray-950/70 border border-suno-gray-850 rounded-xl px-4 py-2.5 text-xs text-gray-500 cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sister Grace"
              required
              className="selah-input"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="selah-input"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">check_circle</span>
              Profile updated successfully!
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-suno-gray-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="selah-btn-secondary px-4 py-2 text-[11px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="selah-btn-primary px-4 py-2 text-[11px]"
            >
              {saving ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[10px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
