import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Simple env file parser
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking Supabase connection to:", supabaseUrl);
  const { data, error } = await supabase.from("song_comments").select("*").limit(1);
  if (error) {
    console.error("Error from song_comments query:", error);
  } else {
    console.log("Success! song_comments table exists:", data);
  }

  const { data: recData, error: recError } = await supabase.from("comment_reactions").select("*").limit(1);
  if (recError) {
    console.error("Error from comment_reactions query:", recError);
  } else {
    console.log("Success! comment_reactions table exists:", recData);
  }
}

test();
