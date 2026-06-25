import { isSafeRedirect, isPrivateIp, isSafeUrl } from "./security.js";
import assert from "assert";

console.log("Running security helper tests...");

// Test isSafeRedirect
assert.strictEqual(isSafeRedirect("/dashboard"), true, "Should allow simple relative path");
assert.strictEqual(isSafeRedirect("/"), true, "Should allow slash path");
assert.strictEqual(isSafeRedirect(""), false, "Should block empty path");
assert.strictEqual(isSafeRedirect(null), false, "Should block null path");
assert.strictEqual(isSafeRedirect("//attacker.com"), false, "Should block protocol-relative URLs");
assert.strictEqual(isSafeRedirect("/\\attacker.com"), false, "Should block protocol-relative with backslash");
assert.strictEqual(isSafeRedirect("\\attacker.com"), false, "Should block starting with backslash");
assert.strictEqual(isSafeRedirect("https://google.com"), false, "Should block absolute URLs");

// Test isPrivateIp
assert.strictEqual(isPrivateIp("127.0.0.1"), true, "Should identify loopback as private");
assert.strictEqual(isPrivateIp("10.0.0.1"), true, "Should identify 10.x.x.x as private");
assert.strictEqual(isPrivateIp("172.16.5.5"), true, "Should identify 172.16-31.x.x as private");
assert.strictEqual(isPrivateIp("172.32.1.1"), false, "Should identify 172.32.x.x as public");
assert.strictEqual(isPrivateIp("192.168.1.1"), true, "Should identify 192.168.x.x as private");
assert.strictEqual(isPrivateIp("169.254.169.254"), true, "Should identify AWS metadata IP as private");
assert.strictEqual(isPrivateIp("8.8.8.8"), false, "Should identify 8.8.8.8 as public");
assert.strictEqual(isPrivateIp("::1"), true, "Should identify IPv6 loopback as private");

// Test isSafeUrl
(async () => {
  assert.strictEqual(await isSafeUrl("http://localhost"), false, "Should block localhost");
  assert.strictEqual(await isSafeUrl("http://127.0.0.1"), false, "Should block 127.0.0.1");
  assert.strictEqual(await isSafeUrl("http://10.0.0.1/stems"), false, "Should block private subnet URLs");
  assert.strictEqual(await isSafeUrl("ftp://google.com"), false, "Should block non-http/https protocols");
  assert.strictEqual(await isSafeUrl("https://google.com"), false, "Should block untrusted google.com");
  assert.strictEqual(await isSafeUrl("https://suno.com/music.mp3"), true, "Should allow trusted Suno URLs");
  assert.strictEqual(await isSafeUrl("https://api.apiframe.ai/v2/jobs/123"), true, "Should allow trusted APIFrame URLs");
  
  console.log("All security helper tests passed successfully!");
})();
