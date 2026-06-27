import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { z } from "zod";
import { buildStylePrompt } from "../../lib/prompts/buildStylePrompt";
import { submitSong, pollSong } from "../../lib/apiframe";
import { checkAndDeductCredit } from "../../lib/credits";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
    responseLimit: false,
  },
};

const StemsSchema = z.object({
  lyrics: z.array(
    z.object({
      part: z.string().optional().nullable(),
      line: z.string().optional().nullable(),
      chords: z.array(z.string()).optional().nullable(),
      arrangement: z.any().optional().nullable(),
    })
  ).optional().nullable(),
  genre: z.string().optional().nullable(),
  musicKey: z.string().optional().nullable(),
  chords: z.array(z.string()).optional().nullable(),
  title: z.string().optional().nullable(),
  vocal_gender: z.string().optional().nullable(),
  emotional_mode: z.string().optional().nullable(),
  instrumentation: z.string().optional().nullable(),
});

const CALL_RESPONSE_TAG_MAP = {
  "(Leader)": "[Leader]",
  "(Choir)": "[Choir]",
  "(All)": "[All]",
  "(Solo)": "[Solo]",
  "(Bridge)": "[Bridge]",
};

function formatLyricsForSuno(lyrics) {
  if (!lyrics || !Array.isArray(lyrics) || lyrics.length === 0) {
    return "[Verse]\nHallelujah, praise the Lord\nYour mercy endures forever";
  }

  const linesByPart = {};
  for (const entry of lyrics) {
    const part = (entry.part || "Verse").trim();
    let line = (entry.line || "").trim();
    if (!line) continue;

    // Translate call-and-response markers into Suno section tags
    for (const [frontendTag, sunoTag] of Object.entries(CALL_RESPONSE_TAG_MAP)) {
      if (line.startsWith(frontendTag)) {
        line = sunoTag + " " + line.slice(frontendTag.length).trim();
        break;
      }
    }

    if (!linesByPart[part]) {
      linesByPart[part] = [];
    }
    linesByPart[part].push(line);
  }

  const formattedSections = [];
  for (const [part, lines] of Object.entries(linesByPart)) {
    formattedSections.push(`[${part}]\n${lines.join("\n")}`);
  }

  return formattedSections.join("\n\n").substring(0, 5000);
}

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

  const userId = sessionUser.id;

  // 2. Validate Inputs
  const validation = StemsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(422).json({
      error: "validation_failed",
      message: "Some fields are invalid. Please check your input.",
      details: validation.error.format(),
    });
  }

  const {
    lyrics,
    genre,
    musicKey,
    chords,
    title,
    vocal_gender,
    emotional_mode,
    instrumentation,
  } = validation.data;

  // 3. Credit Verification and Atomic Deduction (Costs 3 credits)
  console.log(`[Stems] Checking and deducting 3 credits for user: ${userId}`);
  const creditCheck = await checkAndDeductCredit(userId, 3);
  if (!creditCheck.allowed) {
    return res.status(402).json({
      error: "insufficient_credits",
      message: "You have insufficient credits. Please top up to generate songs.",
    });
  }

  try {
    const isInstrumental = instrumentation === "instrumental";
    const lyricsToSend = isInstrumental ? "[Instrumental]" : formatLyricsForSuno(lyrics);

    const stylePrompt = buildStylePrompt({
      genre: genre || "Contemporary",
      key: musicKey || "G",
      chords: chords || [],
      emotionalMode: emotional_mode,
      instrumentation,
      vocalGender: vocal_gender,
    });

    console.log(`[Stems] Submitting job to apiframe.ai — instrumental: ${isInstrumental}`);
    
    // Submit to apiframe.ai
    const compoundJobId = await submitSong({
      lyrics: lyricsToSend,
      stylePrompt,
      vocalGender: vocal_gender,
      instrumentalOnly: isInstrumental,
    });

    console.log(`[Stems] Job submitted successfully. Compound Job ID: ${compoundJobId}`);

    // Poll until complete or 5-minute timeout
    const pollTimeoutMs = 5 * 60 * 1000;
    const pollIntervalMs = 4000;
    const deadline = Date.now() + pollTimeoutMs;
    let result = null;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      console.log(`[Stems] Polling job status for: ${compoundJobId}`);
      const pollRes = await pollSong(compoundJobId);
      if (pollRes && pollRes.status === "complete") {
        result = pollRes;
        break;
      }
    }

    if (!result) {
      throw new Error("Song generation timed out on the AI provider.");
    }

    console.log(`[Stems] Generation complete. Audio URL: ${result.audio_url}`);

    const clientJobId = compoundJobId.split(":")[0];

    return res.status(200).json({
      audio_url: result.audio_url,
      audio_title: result.audio_title,
      tracks: result.tracks,
      task_id: clientJobId,
      source: "apiframe_suno",
      stems: { full_mix: result.audio_url },
    });
  } catch (err) {
    console.error("[Stems] Generation error:", err?.message || err);

    // Rollback credit deduction in case of immediate failure (if possible)
    // For now we return 503 and tell the frontend to fall back
    return res.status(503).json({
      error: "ai_generation_failed",
      message: err?.message || err,
      fallback: "web_audio",
    });
  }
}
