import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { getSong, saveSong, getProfile, getPublicSongs } from "../../lib/songService";
import { ProfileModal } from "../../components/ProfileModal";
import { useAudioContext } from "../../lib/audioContext";
import { Player } from "../../components/Player";
import { supabase } from "../../lib/supabase";

export default function SongPage() {
  const router = useRouter();
  const { id } = router.query;
  const [song, setSong] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userInitials, setUserInitials] = useState("?");

  useEffect(() => {
    if (id) {
      getSong(Number(id)).then((data) => {
        if (data) {
          setSong(data);
        } else {
          console.error("Song not found:", id);
        }
      });
    }
  }, [id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync profile when user is loaded
  useEffect(() => {
    if (user) {
      getProfile(user.id).then((p) => {
        if (p) setProfile(p);
      }).catch(console.error);
    } else {
      setProfile(null);
    }
  }, [user]);

  const [recommendations, setRecommendations] = useState([]);
  useEffect(() => {
    getPublicSongs().then((songsList) => {
      const filtered = (songsList || []).filter(s => String(s.id) !== String(id)).slice(0, 4);
      setRecommendations(filtered);
    }).catch(console.error);
  }, [id]);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setCommentsLoading(true);
    supabase
      .from("song_comments")
      .select(`id, content, created_at, user_id, profiles(display_name, avatar_url)`)
      .eq("song_id", id)
      .order("created_at", { ascending: true })
      .then(async ({ data: comments, error }) => {
        if (error) {
          setCommentError("Could not load comments.");
          setCommentsLoading(false);
          return;
        }
        const commentIds = (comments || []).map((c) => c.id);
        let likes = [];
        if (commentIds.length > 0) {
          const { data: likesData } = await supabase
            .from("comment_reactions")
            .select("comment_id, user_id")
            .in("comment_id", commentIds);
          likes = likesData || [];
        }
        const currentUser = (await supabase.auth.getUser()).data?.user;
        const formatted = (comments || []).map((c) => {
          const commentLikes = likes.filter((l) => l.comment_id === c.id);
          return {
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            user_id: c.user_id,
            author_name: c.profiles?.display_name || "Worshipper",
            author_avatar: c.profiles?.avatar_url || null,
            likes_count: commentLikes.length,
            user_liked: currentUser ? commentLikes.some((l) => l.user_id === currentUser.id) : false,
          };
        });
        setComments(formatted);
        setCommentsLoading(false);
      });
  }, [id]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from("song_comments")
        .insert({ song_id: id, user_id: user.id, content: newComment.trim() })
        .select()
        .single();
      if (error) throw error;
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();
      setComments((prev) => [
        ...prev,
        {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          user_id: data.user_id,
          author_name: profileData?.display_name || "Worshipper",
          author_avatar: profileData?.avatar_url || null,
          likes_count: 0,
          user_liked: false,
        },
      ]);
      setNewComment("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      const { error } = await supabase
        .from("song_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) {
      alert("Please sign in to react to comments.");
      return;
    }
    try {
      const { data: existing } = await supabase
        .from("comment_reactions")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .single();

      let liked;
      if (existing) {
        await supabase.from("comment_reactions").delete().eq("id", existing.id);
        liked = false;
      } else {
        await supabase.from("comment_reactions").insert({ comment_id: commentId, user_id: user.id });
        liked = true;
      }
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              user_liked: liked,
              likes_count: liked ? c.likes_count + 1 : Math.max(0, c.likes_count - 1),
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  const { activeSong, setActiveSong, audioState } = useAudioContext();

  useEffect(() => {
    if (song) {
      setActiveSong(song);
    }
  }, [song, setActiveSong]);

  const handleUpdateSong = async (updatedSong) => {
    setSong(updatedSong);
    try {
      await saveSong(updatedSong);
    } catch (dbErr) {
      console.error("Failed to persist updated song locally:", dbErr);
    }
  };

  const navigateToTab = (tabName) => {
    router.push(`/?tab=${tabName}`);
  };

  const handleClose = () => {
    if (router.query.from) {
      router.push(`/?tab=${router.query.from}`);
    } else {
      router.back();
    }
  };

  if (!song) {
    return (
      <div className="bg-suno-black text-white min-h-screen flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <span className="animate-spin material-symbols-outlined text-4xl text-suno-accent">progress_activity</span>
          <p className="text-sm text-gray-400">Loading Choir Desk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-suno-black text-white selection:bg-suno-accent/30 min-h-screen overflow-x-hidden font-sans">
      <Head>
        <title>SelahAI | Choir Desk &amp; Rehearsal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Sidebar Navigation Shell (Hidden on Mobile) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-suno-gray-900 border-r border-suno-gray-800 flex flex-col p-6 space-y-4 z-50 hidden md:flex">
        <div className="flex flex-col items-center mb-8 border-b border-suno-gray-800 pb-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-suno-gray-900 border border-suno-gray-800 flex items-center justify-center shadow-lg mb-3">
            <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-center mt-2">
            <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-300 font-bold mt-1">Gospel Music App</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => navigateToTab("home")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
          >
            <span className="material-symbols-outlined text-xl">explore</span>
            <span className="text-sm">Discover</span>
          </button>
          <button
            onClick={() => navigateToTab("create")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            <span className="text-sm">Create Studio</span>
          </button>
          <button
            onClick={() => navigateToTab("rehearse")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
          >
            <span className="material-symbols-outlined text-xl">school</span>
            <span className="text-sm">Rehearsal Room</span>
          </button>
          <button
            onClick={() => navigateToTab("library")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
          >
            <span className="material-symbols-outlined text-xl">library_music</span>
            <span className="text-sm">Library</span>
          </button>
          <button
            onClick={() => navigateToTab("community")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-gray-400 hover:text-white hover:bg-suno-gray-800/50"
          >
            <span className="material-symbols-outlined text-xl">groups</span>
            <span className="text-sm">Community Feed</span>
          </button>
        </nav>

        {/* User profile area */}
        <div className="border-t border-suno-gray-800 pt-4">
          {user ? (
            <div
              onClick={() => setShowProfileModal(true)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-suno-gray-800/50 transition-all text-left cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-suno-accent/20 border border-suno-accent/30 flex items-center justify-center shrink-0">
                {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                  <img src={profile?.avatar_url || user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-extrabold text-suno-accent">{userInitials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white truncate group-hover:text-suno-accent transition-colors">
                  {profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-gray-350 truncate font-bold">Settings</p>
              </div>
              <button
                id="sign-out-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  audioState?.stop?.();
                  await supabase.auth.signOut();
                  router.push("/auth");
                }}
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                title="Sign out"
              >
                <span className="material-symbols-outlined text-base">logout</span>
              </button>
            </div>
          ) : (
            <button
              id="sign-in-nav-btn"
              onClick={() => router.push("/auth")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-suno-gray-800/50 transition-all font-medium"
            >
              <span className="material-symbols-outlined text-xl">person</span>
              <span className="text-sm">Sign In</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 pb-24 min-h-screen transition-all duration-300">
        {/* Mobile Top Navbar */}
        <header className="h-16 border-b border-suno-gray-800 flex items-center justify-between px-6 bg-suno-black/85 backdrop-blur-md sticky top-0 z-40 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-base text-white tracking-[0.15em] uppercase font-normal mt-0.5">Selah</h1>
          </div>
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors active:scale-90"
            title="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        </header>

        {/* Player Component */}
        <div className="pt-2">
          <Player 
            song={song} 
            audioState={audioState} 
            onClose={handleClose} 
            onUpdateSong={handleUpdateSong}
            user={user}
            comments={comments}
            commentsLoading={commentsLoading}
            newComment={newComment}
            setNewComment={setNewComment}
            handlePostComment={handlePostComment}
            handleDeleteComment={handleDeleteComment}
            handleLikeComment={handleLikeComment}
            recommendations={recommendations}
          />
        </div>
      </main>

      {/* Full-Screen Drawer Menu (Hamburger Overlay) */}
      {menuOpen && (
        <div className="fixed inset-0 bg-suno-black/95 backdrop-blur-2xl z-[150] flex flex-col items-center justify-center space-y-8 animate-fadeIn">
          <button 
            onClick={() => setMenuOpen(false)}
            className="absolute top-6 right-6 p-2.5 text-gray-400 hover:text-white transition-colors"
            title="Close Menu"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-suno-gray-950 border border-suno-gray-800 flex items-center justify-center shadow-lg mb-3">
              <img src="/logo.png" alt="Selah Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-serif text-2xl text-white tracking-[0.25em] uppercase font-medium">Selah</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold mt-1">Gospel Music App</p>
          </div>
          <nav className="flex flex-col items-center space-y-6">
            <button
              onClick={() => { navigateToTab("home"); setMenuOpen(false); }}
              className="text-xl font-medium text-gray-400 hover:text-white transition-colors"
            >
              Discover
            </button>
            <button
              onClick={() => { navigateToTab("create"); setMenuOpen(false); }}
              className="text-xl font-medium text-gray-400 hover:text-white transition-colors"
            >
              Create Studio
            </button>
            <button
              onClick={() => { navigateToTab("library"); setMenuOpen(false); }}
              className="text-xl font-medium text-gray-400 hover:text-white transition-colors"
            >
              Library
            </button>
            <button
              onClick={() => { navigateToTab("community"); setMenuOpen(false); }}
              className="text-xl font-medium text-gray-400 hover:text-white transition-colors"
            >
              Community Feed
            </button>
          </nav>
        </div>
      )}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        profile={profile}
        onUpdateProfileState={(updated) => setProfile(updated)}
      />
    </div>
  );
}
