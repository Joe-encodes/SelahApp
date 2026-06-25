import { GOSPEL_CORE_IDENTITY } from "../constants/gospelIdentity";
import { EMOTIONAL_MODES } from "../constants/emotionalModes";
import { INSTRUMENTATION_MODIFIERS } from "../constants/instrumentationModes";
import { GENRE_STYLE_MAP } from "../constants/genres";

function cleanTruncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  let truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace !== -1) {
    truncated = truncated.substring(0, lastSpace);
  }
  return truncated.trim().replace(/[,.\s]+$/, "");
}

export function buildStylePrompt({ genre, key, chords, emotionalMode, instrumentation, vocalGender, sectionStructure }) {
  const parts = [];

  const modeDesc = emotionalMode ? EMOTIONAL_MODES[emotionalMode] : null;
  if (modeDesc) parts.push(modeDesc);

  const instDesc = instrumentation ? INSTRUMENTATION_MODIFIERS[instrumentation] : null;
  if (instDesc) parts.push(instDesc);

  // If instrumental only, we omit vocal gender descriptors
  const isInstrumental = instrumentation === "instrumental";

  if (genre) {
    const genreFlavor = GENRE_STYLE_MAP[genre];
    if (genreFlavor) parts.push(genreFlavor);
  }

  if (!isInstrumental) {
    if (vocalGender === "f") {
      parts.push("warm female lead vocalist with clear tone and expressive phrasing");
    } else if (vocalGender === "m") {
      parts.push("powerful male lead vocalist with rich baritone-tenor range");
    } else if (vocalGender === "mixed") {
      parts.push("male and female vocalists trading lead phrases, rich blend");
    }
  }

  if (key) {
    parts.push(`key of ${key}`);
  }

  if (Array.isArray(chords) && chords.length > 0) {
    const chordStr = chords.slice(0, 6).join(", ");
    parts.push(`chord progression: ${chordStr}`);
  }

  if (sectionStructure) {
    parts.push(sectionStructure);
  }

  const otherText = parts.join(", ");
  const maxCoreLen = 1000 - otherText.length - 2;

  if (maxCoreLen <= 0) {
    return cleanTruncate(otherText, 1000);
  }

  const trimmedCore = cleanTruncate(GOSPEL_CORE_IDENTITY, maxCoreLen);
  const fullPrompt = trimmedCore ? `${trimmedCore}, ${otherText}` : otherText;

  return cleanTruncate(fullPrompt, 1000);
}
