import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";
import { generateGospelMidi } from "../../lib/midi";
import { buildGospelProgression } from "../../lib/musicTheory";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb", // Replicate input_audio can be large (up to 4MB-6MB)
    },
    responseLimit: false,
  },
};

const MelodySchema = z.object({
  chords: z.array(z.string()).optional().nullable(),
  genre: z.string().optional().nullable(),
  musicKey: z.string().optional().nullable(),
  barsPerChord: z.number().optional().nullable(),
  input_audio: z.string().optional().nullable(),
  bpm: z.number().optional().nullable(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 1. Verify Authentication
  const supabase = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to continue." });
  }

  // 2. Validate Inputs
  const validation = MelodySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(422).json({
      error: "validation_failed",
      message: "Some fields are invalid. Please check your input.",
      details: validation.error.format(),
    });
  }

  const { chords, genre, musicKey, barsPerChord, input_audio, bpm } = validation.data;

  // 3. Process Cloud Backing (via Replicate) if input_audio is provided
  if (input_audio) {
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(400).json({
        error: "no_replicate_token",
        message:
          "Replicate API token is missing on the server environment. Please set REPLICATE_API_TOKEN in .env.local to enable cloud AI backing tracks.",
      });
    }

    try {
      console.log("[Melody] Submitting prediction to Replicate...");
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
          input: {
            model_version: "stereo-melody-large",
            prompt: `dynamic gospel track with professional piano, drums, bass, high-fidelity, tempo ${
              bpm || 72
            } BPM, style of ${genre || "Contemporary"}`,
            input_audio: input_audio,
            duration: 14,
            continuation: false,
          },
        }),
      });

      let prediction = await response.json();
      if (!response.ok || prediction.error) {
        throw new Error(prediction.error || "Failed to initiate Replicate prediction");
      }

      const getUrl = prediction.urls.get;
      let attempts = 0;
      const maxAttempts = 25;
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        attempts++;

        const pollRes = await fetch(getUrl, {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        });
        if (!pollRes.ok) {
          throw new Error(`Polling failed: HTTP ${pollRes.status}`);
        }
        prediction = await pollRes.json();
        if (prediction.status === "succeeded") {
          break;
        }
        if (prediction.status === "failed" || prediction.status === "canceled") {
          throw new Error(`Replicate generation failed/canceled: ${prediction.error || "unknown"}`);
        }
      }

      if (prediction.status !== "succeeded") {
        throw new Error("Prediction timed out on Replicate.");
      }

      return res.status(200).json({
        backing_url: prediction.output,
      });
    } catch (err) {
      console.error("[Melody Cloud] Replicate generation error:", err?.message || err);
      return res.status(502).json({
        error: "replicate_failed",
        message: `Our music service is temporarily unavailable. Please try again in a moment.`,
      });
    }
  }

  // 4. Fallback: Generate Local MIDI in JS using lib/midi.js
  try {
    const resolvedChords =
      Array.isArray(chords) && chords.length > 0 ? chords : buildGospelProgression(musicKey || "G");

    const tempo = bpm || 72;
    const midiBuffer = generateGospelMidi({
      chords: resolvedChords,
      genre: genre || "Contemporary",
      bpm: tempo,
      barsPerChord: barsPerChord || 1,
    });

    const base64Midi = `data:audio/midi;base64,${midiBuffer.toString("base64")}`;

    return res.status(200).json({
      midi_url: base64Midi,
      task_id: "local_midi_" + Date.now(),
      bpm: tempo,
      chords: resolvedChords,
      status: "ready",
    });
  } catch (err) {
    console.error("[Melody Local] MIDI Generation Error:", err?.message || err);
    return res.status(500).json({
      error: "midi_generation_failed",
      message: "Something went wrong on our end. If this keeps happening, contact support.",
    });
  }
}
