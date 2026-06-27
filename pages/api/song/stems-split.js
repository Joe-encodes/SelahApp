import { createServerSupabaseClient } from "../../../lib/supabaseServer";
import { z } from "zod";
import JSZip from "jszip";
import { generateGospelMidi } from "../../../lib/midi";
import { checkAndDeductCredit } from "../../../lib/credits";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
    responseLimit: false,
  },
};

const StemsSplitSchema = z.object({
  songId: z.union([z.string(), z.number()]),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 1. Verify Authentication
  const supabase = createServerSupabaseClient({ req });
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to continue." });
  }

  const user = sessionUser;

  // 2. Validate Inputs
  const validation = StemsSplitSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(422).json({
      error: "validation_failed",
      message: "Some fields are invalid.",
      details: validation.error.format(),
    });
  }

  const { songId } = validation.data;

  try {
    // 3. Fetch Song Details
    const { data: song, error: fetchErr } = await supabase
      .from("songs")
      .select("*")
      .eq("id", songId)
      .single();

    if (fetchErr || !song) {
      return res.status(404).json({ error: "not_found", message: "Song not found." });
    }

    // 4. Verify Ownership
    if (song.user_id !== user.id) {
      return res.status(403).json({
        error: "forbidden",
        message: "You do not have permission to download stems for this song.",
      });
    }

    // 5. Credit check and atomic deduction (deduct 3 credits for stems separation)
    console.log(`[StemsSplit] Deducting credits for user ${user.id}...`);
    const creditCheck = await checkAndDeductCredit(user.id, 3);
    if (!creditCheck.allowed) {
      return res.status(402).json({
        error: "insufficient_credits",
        message: "Insufficient credits. Splitting song stems requires 3 credits.",
      });
    }

    const zip = new JSZip();
    const zipName = `Selah_${song.title.replace(/[\s/\\?%*:|"<>]/g, "_")}_stems.zip`;

    // 6. Generate local MIDI file and add to ZIP
    try {
      console.log("[StemsSplit] Generating backing MIDI file...");
      const midiBuffer = generateGospelMidi({
        chords: song.chords || ["C", "F", "G", "Am"],
        genre: song.genre || "Contemporary",
        bpm: 72,
        barsPerChord: 1,
      });
      zip.file("backing_track.mid", midiBuffer);
    } catch (midiErr) {
      console.warn("[StemsSplit] MIDI generation warning:", midiErr?.message || midiErr);
    }

    // 7. Fetch the Suno full mix MP3 if present and add to ZIP
    let fullMixBuffer = null;
    if (song.audio_url) {
      try {
        const { isSafeUrl } = require("../../../lib/security");
        if (!(await isSafeUrl(song.audio_url))) {
          console.warn("[StemsSplit] Blocked potentially unsafe URL:", song.audio_url);
        } else {
          console.log(`[StemsSplit] Downloading full mix from ${song.audio_url}...`);
          const response = await fetch(song.audio_url);
          if (response.ok) {
            fullMixBuffer = await response.arrayBuffer();
            zip.file("full_mix.mp3", Buffer.from(fullMixBuffer));
          }
        }
      } catch (dlErr) {
        console.warn("[StemsSplit] Full mix download warning:", dlErr?.message || dlErr);
      }
    }

    // 8. If Replicate API token is configured, perform AI stems separation (vocals vs backing)
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    let separateStatus = "skipped";

    if (replicateToken && song.audio_url) {
      try {
        separateStatus = "initiated";
        console.log("[StemsSplit] Triggering AI separation via Replicate Demucs...");
        
        // Trigger Demucs on Replicate
        const repRes = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${replicateToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953",
            input: {
              audio: song.audio_url,
            },
          }),
        });

        if (!repRes.ok) {
          throw new Error(`Replicate API returned status ${repRes.status}`);
        }

        let prediction = await repRes.json();
        const getUrl = prediction.urls.get;
        let attempts = 0;
        const maxAttempts = 35; // ~70 seconds poll timeout

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;

          const pollRes = await fetch(getUrl, {
            headers: {
              Authorization: `Token ${replicateToken}`,
            },
          });
          if (!pollRes.ok) {
            throw new Error(`Polling failed status ${pollRes.status}`);
          }
          prediction = await pollRes.json();
          if (prediction.status === "succeeded") {
            break;
          }
          if (prediction.status === "failed" || prediction.status === "canceled") {
            throw new Error(`Separation failed in prediction: ${prediction.error}`);
          }
        }

        if (prediction.status === "succeeded" && prediction.output) {
          const outputs = prediction.output;
          console.log("[StemsSplit] Stems separation completed successfully. Downloading stems...");

          // Helper: fetch file and save to zip
          const addStemToZip = async (url, filename) => {
            try {
              const res = await fetch(url);
              if (res.ok) {
                const ab = await res.arrayBuffer();
                zip.file(filename, Buffer.from(ab));
                return true;
              }
            } catch (e) {
              console.warn(`Failed to add stem ${filename}:`, e?.message || e);
            }
            return false;
          };

          await Promise.all([
            addStemToZip(outputs.vocals, "vocals.wav"),
            addStemToZip(outputs.drums, "drums.wav"),
            addStemToZip(outputs.bass, "bass.wav"),
            addStemToZip(outputs.other, "accompaniment.wav"),
          ]);
          separateStatus = "success";
        } else {
          separateStatus = "timeout";
        }
      } catch (splitErr) {
        console.error("[StemsSplit] AI separation failed:", splitErr?.message || splitErr);
        separateStatus = "failed";
      }
    }

    // 9. Generate ZIP buffer and stream back

    // 10. Generate ZIP buffer and stream back
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    return res.status(200).send(zipBuffer);
  } catch (err) {
    console.error("[StemsSplit] Unexpected error:", err?.message || err);
    return res.status(500).json({
      error: "server_error",
      message: "Something went wrong on our end. If this keeps happening, contact support.",
    });
  }
}
