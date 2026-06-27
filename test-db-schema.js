import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkSchema() {
  console.log("Testing live database relationships directly against the API...");
  
  try {
    // We test if the 'songs' table can successfully join with 'profiles' and 'song_likes'
    // If it works, it means the foreign keys are set up correctly.
    console.log("\n--- TESTING API JOIN (songs -> profiles, song_likes) ---");
    
    const joinRes = await fetch(`${supabaseUrl}/rest/v1/songs?select=id,profiles(display_name),song_likes(count)&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (joinRes.ok) {
      const data = await joinRes.json();
      console.log("✅ SUCCESS! The API successfully joined 'songs' with 'profiles' and 'song_likes'.");
      console.log("✅ The foreign keys are correct and the PGRST200 error is resolved.");
      console.log("\nSample API Return Data:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      const err = await joinRes.json();
      console.error("❌ FAILED! The API could not join the tables.");
      console.error("Error Details:", JSON.stringify(err, null, 2));
      console.error("\nIf you see PGRST200 here, you need to run the updated lib/schema.sql in your Supabase SQL Editor.");
    }

  } catch (err) {
    console.error("Error verifying schema:", err.message);
  }
}

checkSchema();
