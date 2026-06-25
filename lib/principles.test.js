import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running principles static analysis tests...");

// 1. Verify generate.js simplification
const generateContent = fs.readFileSync(path.join(__dirname, "../pages/api/generate.js"), "utf8");
assert.ok(!generateContent.includes("truncateAtWordBoundary"), "generate.js should not contain truncateAtWordBoundary helper");
assert.ok(!generateContent.includes("replace(/^```json"), "generate.js should not contain regex JSON cleaning");
console.log("✓ generate.js static checks passed");


const saveContent = fs.readFileSync(path.join(__dirname, "../pages/api/song/save.js"), "utf8");
assert.ok(!saveContent.includes("Fetch existing song to verify ownership"), "save.js should not perform separate ownership select");
assert.ok(saveContent.includes('.eq("user_id", user.id)'), "save.js should check user_id in the update query");
console.log("✓ save.js static checks passed");

console.log("All principles static analysis tests passed successfully!");
