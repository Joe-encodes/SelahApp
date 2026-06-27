import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { z } from "zod";
import { buildGospelProgression } from "../../lib/musicTheory";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

// Input validation schema using Zod
const GenerateSchema = z.object({
  theme: z.string().max(100).optional().nullable(),
  musicKey: z.string().max(10).optional().nullable(),
  langs: z.array(z.string()).optional().nullable(),
  genre: z.string().optional().nullable(),
  harmony: z.string().optional().nullable(),
  scripture: z.string().max(500).optional().nullable(),
  rawSongText: z.string().max(4000).optional().nullable(),
  emotional_mode: z.enum([
    "lament_comfort",
    "triumph_declaration",
    "rest_surrender",
    "wonder_intimacy",
    "joy_celebration",
    "defiance_warfare",
  ]).optional().nullable(),
  instrumentation: z.enum([
    "full_band",
    "vocal_piano",
    "a_cappella",
    "instrumental",
  ]).optional().nullable(),
  vocal_gender: z.enum(["m", "f", "mix", "mixed"]).optional().nullable(),
  temperature: z.number().min(0.0).max(2.0).optional().nullable(),
});

function cleanJsonResponse(rawText) {
  return JSON.parse(rawText.trim());
}

// Key rotation for Groq
async function callGroq(messages, temperature = 0.7, maxTokens = 1500) {
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
  ].filter(Boolean);

  if (groqKeys.length === 0) {
    throw new Error("No GROQ_API_KEY configured.");
  }

  let lastError = null;
  for (const key of groqKeys) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`[groq] Key rotation warning: ${err?.message || err}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Groq keys failed");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 1. Verify Authentication
  const supabase = createServerSupabaseClient({ req });
  const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser();

  if (!sessionUser) {
    return res.status(401).json({ error: "Unauthorized", message: "Please sign in to continue." });
  }
  const session = { user: sessionUser };

  // 2. Validate Inputs with Zod
  const validation = GenerateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(422).json({
      error: "validation_failed",
      message: "Some fields are invalid. Please check your input.",
      details: validation.error.format(),
    });
  }

  const {
    theme,
    musicKey,
    langs,
    genre,
    scripture,
    rawSongText,
    emotional_mode,
    instrumentation,
    vocal_gender,
    temperature,
  } = validation.data;

  const keyToUse = musicKey || "G";
  const cleanTheme = theme || "";
  const cleanScripture = scripture || "";
  const cleanRawSongText = rawSongText || "";

  // Fallback / Mock song builder
  const buildMockSong = () => {
    const defaultSections = [
      {
        part: "Intro",
        lyrics: ["(Instrumental Intro)"],
        chords: buildGospelProgression(keyToUse),
        arrangement: { dynamics: "piano", percussion: "mute" },
      },
      {
        part: "Verse 1",
        lyrics: [
          `Lord, we lift our hearts in ${cleanTheme || "worship"} today`,
          "Every breath we breathe, Your mercies never fade away",
        ],
        chords: buildGospelProgression(keyToUse),
        arrangement: { dynamics: "mezzo", percussion: "rimshot" },
      },
      {
        part: "Chorus",
        lyrics: [
          "Hallelujah! Worthy is the Lamb!",
          "All the glory, honour, power — praise His name!",
        ],
        chords: buildGospelProgression(keyToUse),
        arrangement: { dynamics: "forte", percussion: "full" },
      },
      {
        part: "Bridge",
        lyrics: [
          "(Leader) He is worthy — (Choir) Worthy!",
          "(Leader) He is able — (Choir) Able!",
        ],
        chords: buildGospelProgression(keyToUse),
        arrangement: { dynamics: "forte", percussion: "heavy" },
      },
      {
        part: "Outro",
        lyrics: ["Praise the Lord, praise the Lord, praise His holy name"],
        chords: buildGospelProgression(keyToUse),
        arrangement: { dynamics: "piano", percussion: "light" },
      },
    ];

    const flatLyrics = [];
    defaultSections.forEach((section) => {
      const chordsPerLine = Math.max(1, Math.ceil(section.chords.length / section.lyrics.length));
      section.lyrics.forEach((line, li) => {
        const start = li * chordsPerLine;
        const end = Math.min(start + chordsPerLine, section.chords.length);
        const lineChords = section.chords.slice(start, end);
        flatLyrics.push({
          part: section.part,
          line: line,
          chords: lineChords.length > 0 ? lineChords : [section.chords[section.chords.length - 1]],
          arrangement: section.arrangement,
        });
      });
    });

    return {
      title: `${cleanTheme || "Grace"} (Key of ${keyToUse})`,
      scripture: cleanScripture || "Psalm 150:6",
      lyrics: flatLyrics,
      chords: flatLyrics.flatMap((l) => l.chords),
    };
  };

  // If we have raw song text input, process it with a single structure-focused Groq call
  if (cleanRawSongText) {
    try {
      const systemMessage = {
        role: "system",
        content: `You are an expert Music Director and Choral Arranger. You always respond with a valid JSON object matching this schema:
{
  "title": "Song Title",
  "scripture": "Scripture Anchor",
  "sections": [
    {
      "part": "Intro" | "Verse 1" | "Chorus" | "Verse 2" | "Bridge" | "Outro" | "Tag",
      "lyrics": ["Lyric line 1", "Lyric line 2"],
      "chords": ["Chord1", "Chord2"],
      "arrangement": { "dynamics": "piano" | "mezzo" | "forte", "percussion": "mute" | "light" | "full" | "heavy" | "solo" },
      "production_notes": "production notes description"
    }
  ]
}`,
      };

      const userPrompt = `Analyze and structure the following existing raw song lyrics and chords into choir practice parts in the key of ${keyToUse}:
"${cleanRawSongText}"

Rules:
1. Segment lines cleanly into sections.
2. If chords are in the input, extract and align them. If not, suggest a gospel progression in the key of ${keyToUse}.
3. Call-and-response lines must be prefixed with "(Leader)" or "(Choir)".`;

      const response = await callGroq([systemMessage, { role: "user", content: userPrompt }], 0.3);
      const parsed = cleanJsonResponse(response.choices[0].message.content);
      const output = formatParsedSong(parsed, genre, emotional_mode, instrumentation, vocal_gender);
      return res.status(200).json(output);
    } catch (err) {
      console.error("[generate] Error processing raw song text:", err?.message || err);
      return res.status(200).json(buildMockSong());
    }
  }

  // Two-Call Pipeline for fresh generation
  try {
    // --- Call 1: Structure & Chords (Low temperature for correctness) ---
    const systemCall1 = {
      role: "system",
      content: `You are an expert African Gospel Music Director and Arranger.
You design song structures and chord progressions.
You must return ONLY a valid JSON object matching this schema:
{
  "title": "A creative title based on theme/scripture",
  "scripture": "Relevant book chapter:verse or matching anchor",
  "sections": [
    {
      "part": "Intro" | "Verse 1" | "Chorus" | "Verse 2" | "Bridge" | "Tag" | "Outro",
      "bars": number,
      "chords": ["Chord1", "Chord2", ...], // 1 chord per bar. Use valid gospel/jazz notation (C, Eb, F, Gm, Am7, G7, Cmaj7, etc.)
      "arrangement": {
        "dynamics": "piano" | "mezzo" | "forte",
        "percussion": "mute" | "light" | "full" | "heavy" | "solo"
      }
    }
  ]
}`,
    };

    const userCall1 = `Theme: ${cleanTheme || "Grace"}
Key: ${keyToUse}
Genre: ${genre || "Contemporary"}
Scripture hint: ${cleanScripture || "Worship"}
Emotional Mode: ${emotional_mode || "triumph_declaration"}

Create a structure including Intro, Verse 1, Chorus, Verse 2, Chorus, Bridge, Tag, Outro. The progressions must feel like authentic gospel chords. Intro has 4 bars, mute percussion.`;

    console.log("[generate] Executing Call 1 (Structure & Chords)...");
    const responseCall1 = await callGroq([systemCall1, { role: "user", content: userCall1 }], 0.3);
    const structure = cleanJsonResponse(responseCall1.choices[0].message.content);

    // If instrumental mode is requested, we skip Call 2 entirely!
    if (instrumentation === "instrumental") {
      console.log("[generate] Instrumental mode requested: skipping Call 2.");
      const sections = structure.sections.map((sec) => ({
        ...sec,
        lyrics: sec.part === "Intro" ? ["(Instrumental Intro)"] : ["(Instrumental)"],
        production_notes: `${sec.part} - Instrumental backing`,
      }));
      const parsed = {
        title: structure.title || `${cleanTheme || "Grace"} (Instrumental)`,
        scripture: structure.scripture || cleanScripture || "Psalm 150:6",
        sections,
      };
      const output = formatParsedSong(parsed, genre, emotional_mode, instrumentation, vocal_gender);
      return res.status(200).json(output);
    }

    // --- Call 2: Lyrics (Creative temperature) ---
    const systemCall2 = {
      role: "system",
      content: `You are an expert African Gospel Lyricist.
You write beautiful, moving lyrics that flow naturally with the musical structure.
You must return ONLY a valid JSON object matching this schema:
{
  "title": "Title here",
  "scripture": "Scripture here",
  "sections": [
    {
      "part": "Section Name",
      "lyrics": ["Line 1", "Line 2", ...], // Each line corresponds to 1 or 2 bars. Call-and-response must start with "(Leader)" or "(Choir)"
      "chords": ["Chord1", "Chord2", ...], // Keep these identical to input
      "arrangement": { "dynamics": "piano" | "mezzo" | "forte", "percussion": "mute" | "light" | "full" | "heavy" | "solo" }, // Keep identical
      "production_notes": "notes explaining arrangement dynamics and feeling"
    }
  ]
}`,
    };

    const userCall2 = `Structure:
${JSON.stringify(structure, null, 2)}

Parameters:
- Languages: ${langs ? langs.join(", ") : "English"}
- Vocal Lead: ${vocal_gender || "mixed"}
- Emotional Mode: ${emotional_mode || "triumph_declaration"}

Write lyrics matching each section.
Rules:
1. Translate scripture "${structure.scripture || cleanScripture}" into first-person testimony prayer (e.g. "I will stand", "You are my shield"), NOT a direct scripture quote.
2. Incorporate call-and-response tags: prefix lines with "(Leader)" or "(Choir)".
3. Intro section lyrics must be exactly ["(Instrumental Intro)"].
4. Add authentic African gospel expressions (e.g., "Oluwa", "Chineke", "Imela") where appropriate for flavor.`;

    console.log("[generate] Executing Call 2 (Lyrics generation)...");
    const Call2Temp = temperature ?? 0.75;
    const responseCall2 = await callGroq([systemCall2, { role: "user", content: userCall2 }], Call2Temp);
    const parsed = cleanJsonResponse(responseCall2.choices[0].message.content);

    const output = formatParsedSong(parsed, genre, emotional_mode, instrumentation, vocal_gender);
    return res.status(200).json(output);
  } catch (err) {
    console.error("[generate] Error in Two-Call Pipeline:", err?.message || err);
    return res.status(200).json(buildMockSong());
  }
}

// Flat-maps the multi-section JSON output into the final structure expected by the frontend
function formatParsedSong(parsed, genre, emotional_mode, instrumentation, vocal_gender) {
  const flatLyrics = [];
  if (parsed.sections && Array.isArray(parsed.sections)) {
    parsed.sections.forEach((section) => {
      const lyricsList = section.lyrics || [""];
      const chordsList = section.chords || ["G"];
      const chordsPerLine = Math.max(1, Math.ceil(chordsList.length / lyricsList.length));

      lyricsList.forEach((line, li) => {
        const start = li * chordsPerLine;
        const end = Math.min(start + chordsPerLine, chordsList.length);
        const lineChords = chordsList.slice(start, end);
        flatLyrics.push({
          part: section.part || "Section",
          line: line,
          chords: lineChords.length > 0 ? lineChords : [chordsList[chordsList.length - 1] || "G"],
          arrangement: section.arrangement || { dynamics: "mezzo", percussion: "full" },
        });
      });
    });
  }

  const flatChords = flatLyrics.flatMap((l) => l.chords);

  return {
    title: parsed.title || "Gospel Song",
    scripture: parsed.scripture || "Psalm 150:6",
    lyrics: flatLyrics,
    chords: flatChords,
    genre: genre || "Contemporary",
    emotional_mode: emotional_mode || null,
    instrumentation: instrumentation || null,
    vocal_gender: vocal_gender || null,
  };
}
