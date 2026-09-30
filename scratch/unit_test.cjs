const fs = require('fs');
const path = require('path');

const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Extract the helper section between hashPin and handleAIResponse
const start = serverCode.indexOf('// ── Deterministic helpers for AI chat invariants ─────────────');
const end = serverCode.indexOf('// Helper: generate AI response for a combined user message');

if (start === -1 || end === -1) {
  console.error("Could not find helper section");
  process.exit(1);
}

const helperCode = serverCode.substring(start, end);
eval(helperCode);

console.log("1. Typo Normalization:");
const t1 = normalizeMessageTypos("Need a Nanny for a 2.5 year ild");
console.log("  Input: 'Need a Nanny for a 2.5 year ild' ->", t1);
if (t1 !== "Need a Nanny for a 2.5 years old") throw new Error("t1 failed");

const t2 = normalizeMessageTypos("500 pee hour");
console.log("  Input: '500 pee hour' ->", t2);
if (t2 !== "500 per hour") throw new Error("t2 failed");

console.log("2. Location Detection:");
const loc1 = hasUserSharedLocation("Can you send tomorrow at 5PM\nFor 1 hr");
console.log("  'Can you send tomorrow at 5PM\\nFor 1 hr' ->", loc1);
if (loc1 !== false) throw new Error("loc1 should be false");

const loc2 = hasUserSharedLocation("Need session in Whitefield");
console.log("  'Need session in Whitefield' ->", loc2);
if (loc2 !== true) throw new Error("loc2 should be true");

const loc3 = hasUserSharedLocation("My location is Sompura Gate, Sarjapura Road");
console.log("  'My location is Sompura Gate, Sarjapura Road' ->", loc3);
if (loc3 !== true) throw new Error("loc3 should be true");

const loc4 = hasUserSharedLocation("Location is 560102");
console.log("  'Location is 560102' ->", loc4);
if (loc4 !== true) throw new Error("loc4 should be true");

console.log("3. Age Extraction:");
const a1 = extractChildAgeFromText("Need a Nanny for a 2.5 year ild");
console.log("  'Need a Nanny for a 2.5 year ild' ->", a1);
if (a1 !== 2.5) throw new Error("a1 should be 2.5");

const a2 = extractChildAgeFromText("2.5");
console.log("  '2.5' ->", a2);
if (a2 !== 2.5) throw new Error("a2 should be 2.5");

const a3 = extractChildAgeFromText("10 months");
console.log("  '10 months' ->", a3);
if (a3 !== "10 months") throw new Error("a3 should be '10 months'");

console.log("4. Activity Pitch for Age:");
const p1 = getActivityPitchForAge(2.5);
console.log("  Pitch for 2.5 contains:", p1.slice(0, 60) + "...");
if (!p1.includes("verbal interaction, age appropriate puzzles") || !p1.includes("[PRICING_IMAGE]")) {
  throw new Error("Pitch for 2.5 failed");
}

console.log("\nALL UNIT TESTS PASSED SUCCESSFULLY! ✅");
