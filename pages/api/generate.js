export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { theme, musicKey, langs, genre, harmony, scripture, rawSongText } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  // Helper: return a rich mock song so the UI never breaks
  const mockSong = () => {
    const defaultSections = [
      {
        part: "Intro",
        lyrics: ["(Instrumental Intro)"],
        chords: buildChords(musicKey),
        arrangement: { dynamics: "piano", percussion: "mute" }
      },
      {
        part: "Verse 1",
        lyrics: [
          `Lord, we lift our hearts in ${theme || "worship"} today`,
          "Every breath we breathe, Your mercies never fade away"
        ],
        chords: buildChords(musicKey),
        arrangement: { dynamics: "mezzo", percussion: "rimshot" }
      },
      {
        part: "Chorus",
        lyrics: [
          "Hallelujah! Worthy is the Lamb!",
          "All the glory, honour, power — praise His name!"
        ],
        chords: buildChords(musicKey),
        arrangement: { dynamics: "forte", percussion: "full" }
      },
      {
        part: "Bridge",
        lyrics: [
          "(Leader) He is worthy — (Choir) Worthy!",
          "(Leader) He is able — (Choir) Able!"
        ],
        chords: buildChords(musicKey),
        arrangement: { dynamics: "forte", percussion: "heavy" }
      },
      {
        part: "Tag",
        lyrics: [
          "Praise the Lord, praise the Lord, praise His holy name"
        ],
        chords: buildChords(musicKey),
        arrangement: { dynamics: "piano", percussion: "light" }
      }
    ];

    const flatLyrics = [];
    defaultSections.forEach(section => {
      const chordsPerLine = Math.max(1, Math.ceil(section.chords.length / section.lyrics.length));
      section.lyrics.forEach((line, li) => {
        const start = li * chordsPerLine;
        const end = Math.min(start + chordsPerLine, section.chords.length);
        const lineChords = section.chords.slice(start, end);
        flatLyrics.push({
          part: section.part,
          line: line,
          chords: lineChords.length > 0 ? lineChords : [section.chords[section.chords.length - 1]],
          arrangement: section.arrangement
        });
      });
    });

    return {
      title: `${theme || "Grace"} (Key of ${musicKey})`,
      scripture: scripture || "Psalm 150:6",
      lyrics: flatLyrics,
      chords: flatLyrics.flatMap(l => l.chords),
    };
  };

  if (!GROQ_API_KEY) {
    console.log("⚠️  No GROQ_API_KEY found. Returning mock song.");
    return res.status(200).json(mockSong());
  }

  const prompt = rawSongText 
    ? `You are an expert Music Director and Choral Arranger.
Task: Analyze and structure the following existing raw song lyrics and chords into choir practice parts:
"${rawSongText}"

Rules:
1. Identify the Title and a relevant Scriptural Anchor for this song.
2. Segment the lines cleanly into parts (e.g., Intro, Verse 1, Chorus, Verse 2, Bridge, Tag, Outro).
3. If chords are written in the input text, extract them. If not, suggest a solid gospel chord progression in the key of ${musicKey}.
4. Return ONLY valid JSON (absolutely no markdown, no code fences, no extra text), in this exact shape:
{
  "title": "Song Title Here",
  "scripture": "Book Chapter:Verse",
  "sections": [
    {
      "part": "Intro",
      "lyrics": ["(Instrumental Intro)"],
      "chords": ["Chord1", "Chord2"],
      "arrangement": {"dynamics": "piano", "percussion": "mute"}
    },
    {
      "part": "Verse 1",
      "lyrics": ["Lyric line 1 here", "Lyric line 2 here"],
      "chords": ["Chord1", "Chord2", "Chord3", "Chord4"],
      "arrangement": {"dynamics": "mezzo", "percussion": "rimshot"}
    },
    {
      "part": "Chorus",
      "lyrics": ["Chorus line 1 here", "Chorus line 2 here"],
      "chords": ["Chord1", "Chord2", "Chord3", "Chord4"],
      "arrangement": {"dynamics": "forte", "percussion": "full"}
    }
  ]
}`
    : `You are an expert African Gospel Songwriter and Music Theorist.
Task: Write a gospel song based on the following parameters:
- Theme: ${theme}
- Key: ${musicKey}
- Languages: ${langs.join(', ')} (Use natural code-switching where appropriate)
- Genre: ${genre}
- Scripture Anchor: ${scripture || 'Choose a relevant scripture'}

Rules:
1. Structure MUST follow a multi-section arrangement: Intro, Verse 1, Chorus, Verse 2, Chorus, Bridge, Tag, Outro.
2. Include call-and-response (Leader / Choir) elements naturally.
3. Use cultural African gospel idioms (e.g., "Oluwa", "Ese o", "Chineke", "Testimony", "Hallelujah", "Imela") where language allows.
4. Suggest solid gospel progressions in the key of ${musicKey}. Ensure the Chorus and Bridge sections feel musically distinct from the Verses.
5. Define the dynamic arrangement details for each section (e.g. quieter Intro, driving Chorus percussion).

Return ONLY valid JSON (absolutely no markdown, no code fences, no extra text), in this exact shape:
{
  "title": "Song Title Here",
  "scripture": "Book Chapter:Verse",
  "sections": [
    {
      "part": "Intro",
      "lyrics": ["(Instrumental Intro)"],
      "chords": ["Chord1", "Chord2"],
      "arrangement": {"dynamics": "piano", "percussion": "mute"}
    },
    {
      "part": "Verse 1",
      "lyrics": ["Lyric line 1", "Lyric line 2"],
      "chords": ["Chord1", "Chord2", "Chord3", "Chord4"],
      "arrangement": {"dynamics": "mezzo", "percussion": "rimshot"}
    },
    {
      "part": "Chorus",
      "lyrics": ["Chorus line 1", "Chorus line 2"],
      "chords": ["Chord1", "Chord2", "Chord3", "Chord4"],
      "arrangement": {"dynamics": "forte", "percussion": "full"}
    }
  ]
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert African Gospel Songwriter. You always respond with valid JSON only. No markdown. No explanation. Just the JSON object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.85,
        max_tokens: 1500,
      })
    });

    const data = await response.json();

    console.log("✅ Groq API status:", response.status);

    if (data.error) {
      console.error("❌ Groq API Error:", data.error.message);
      return res.status(200).json(mockSong());
    }

    const rawText = data.choices[0].message.content.trim();
    console.log("🎵 Groq raw response:", rawText);

    const cleaned = rawText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const flatLyrics = [];
    if (parsed.sections && Array.isArray(parsed.sections)) {
      parsed.sections.forEach(section => {
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
            arrangement: section.arrangement || { dynamics: "mezzo", percussion: "full" }
          });
        });
      });
    }

    const flatChords = flatLyrics.flatMap(l => l.chords);

    console.log("🎶 Successfully generated structured gospel song:", parsed.title);
    return res.status(200).json({
      title: parsed.title,
      scripture: parsed.scripture,
      lyrics: flatLyrics,
      chords: flatChords,
      genre: genre,
    });

  } catch (error) {
    console.error("❌ Error generating song:", error.message);
    return res.status(200).json(mockSong());
  }
}

// Builds a gospel 1-4-5-6 chord progression for any root key
function buildChords(root) {
  const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const idx = NOTES.indexOf(root);
  if (idx === -1) return [root, "F", "G", "Am"];
  const I  = NOTES[idx];
  const IV = NOTES[(idx + 5) % 12];
  const V  = NOTES[(idx + 7) % 12];
  const VI = NOTES[(idx + 9) % 12] + "m";
  return [I, IV, V, VI];
}
