export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const groqKeySet = !!process.env.GROQ_API_KEY;
  const apiframeKeySet = !!(
    process.env.APIFRAME_API_KEY ||
    process.env.APIFRAME_API_KEY1 ||
    process.env.APIFRAME_API_KEY2 ||
    process.env.APIFRAME_API_KEY_1 ||
    process.env.APIFRAME_API_KEY_2
  );

  return res.status(200).json({
    status: "ok",
    service: "SelahAI Audio Synthesis Service (Next.js Migrated)",
    groq: groqKeySet,
    apiframe: apiframeKeySet,
    timestamp: new Date().toISOString(),
  });
}
