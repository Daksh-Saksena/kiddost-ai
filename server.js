import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import crypto from "crypto";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load & parse example WhatsApp chat transcripts ──────────────────────────
// Format per line: [DD/MM/YY, HH:MM:SS AM/PM] Name: message
const CHATS_DIR = path.join(__dirname, "chats");
const KIDDOST_LABEL = "KidDost Tech Pvt Ltd";
const STOP_WORDS = new Set(["i","me","my","we","our","you","your","the","a","an","is","it","in","on","at","to","of","and","or","for","with","be","am","are","was","were","do","did","can","will","have","has","had","not","this","that","so","just","ok","okay","hi","hello","thank","thanks","please","sure","yes","no","get","let","us","know","if","would","could","also","he","she","they","them","what","when","how","why","who","its","any","all","now","up","more","but","by","as","from","been","then","than","there","about","after","before","may","might","use"]);

function parseChatFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const msgs = [];
  const lineRe = /^\[[\d\/]+,\s[\d:]+(?:\s[AP]M)?\]\s([^:]+):\s([\s\S]*)/;
  let cur = null;
  for (const line of lines) {
    const m = line.match(lineRe);
    if (m) {
      if (cur) msgs.push(cur);
      const speaker = m[1].trim();
      const text = m[2].trim();
      // Skip system messages and media/call placeholders
      if (/end-to-end encrypted|omitted|Missed|This message was deleted|edited/i.test(text)) { cur = null; continue; }
      cur = { role: speaker === KIDDOST_LABEL ? "kiddost" : "customer", text };
    } else if (cur && line.trim()) {
      cur.text += " " + line.trim();
    }
  }
  if (cur) msgs.push(cur);
  return msgs;
}

function scoreKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Load all chats at startup
const EXAMPLE_CHATS = [];
try {
  const files = fs.readdirSync(CHATS_DIR).filter(f => f.endsWith(".txt"));
  for (const file of files) {
    const msgs = parseChatFile(path.join(CHATS_DIR, file));
    if (msgs.length > 2) {
      const fullText = msgs.map(m => m.text).join(" ");
      EXAMPLE_CHATS.push({ file, msgs, keywords: scoreKeywords(fullText) });
    }
  }
  console.log(`[chat-examples] Loaded ${EXAMPLE_CHATS.length} example conversations`);
} catch (e) {
  console.error("[chat-examples] Failed to load chats:", e.message);
}

// Fetch KidDost website content at startup for AI knowledge base
let KIDDOST_WEBSITE_CONTENT = "";
(async () => {
  try {
    const { data } = await axios.get("https://www.kiddost.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KidDostBot/1.0)" },
      timeout: 15000
    });
    let text = data.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    text = text.replace(/\s+/g, " ").trim();
    // Keep first 4000 chars of meaningful content (skip leading CSS junk)
    const idx = text.indexOf("KidDost");
    KIDDOST_WEBSITE_CONTENT = text.substring(idx >= 0 ? idx : 0, (idx >= 0 ? idx : 0) + 4000);
    console.log("[website] Loaded KidDost website content:", KIDDOST_WEBSITE_CONTENT.length, "chars");
  } catch (e) {
    console.error("[website] Failed to fetch website content:", e.message);
  }
})();

// Find the most relevant example conversation for a given customer message
function findBestExampleChat(customerMessage) {
  if (!EXAMPLE_CHATS.length) return null;
  const queryWords = new Set(scoreKeywords(customerMessage));
  if (!queryWords.size) return null;
  let best = null, bestScore = 0;
  for (const chat of EXAMPLE_CHATS) {
    const overlap = chat.keywords.filter(w => queryWords.has(w)).length;
    const score = overlap / Math.sqrt(chat.keywords.length || 1);
    if (score > bestScore) { bestScore = score; best = chat; }
  }
  return bestScore > 0 ? best : EXAMPLE_CHATS[0];
}

// Format an example chat into a readable block for the AI prompt
function sanitizeExampleText(text) {
  return text
    // Remove URLs
    .replace(/https?:\/\/\S+/g, "[link]")
    // Remove Indian rupee prices e.g. Rs 500, Rs. 1000, ₹500
    .replace(/(?:Rs\.?\s*|₹\s*)\d[\d,]*/gi, "[price]")
    // Remove time ranges e.g. 9:30 AM, 5:45-7:45 PM, 6-8pm
    .replace(/\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)/g, "[time]")
    .replace(/\d{1,2}(?::\d{2})?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?/g, "[time range]")
    // Remove session/number counts e.g. "11 sessions", "3 hours"
    .replace(/\b\d+\s+(?:session|hour|hr)s?\b/gi, "[X sessions]")
    // Remove specific days/dates e.g. "coming Monday", "24/06/25"
    .replace(/\b(?:coming\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "[day]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[date]")
    // Remove image omitted artifacts
    .replace(/\u200e\[.*?\]\s*KidDost Tech Pvt Ltd:.*?omitted/g, "")
    .replace(/image omitted/gi, "")
    // Remove timestamps inside text e.g. [24/06/25, 1:24:52 PM]
    .replace(/\[[\d\/]+,\s[\d:]+\s(?:AM|PM)\]/g, "")
    // Remove proper names (simple heuristic: standalone capitalized word not at start of line)
    .replace(/(?<=[A-Za-z,] )([A-Z][a-z]+)(?= ,|\?|!|\.|$)/g, "[name]")
    .trim();
}

function formatExampleChat(chat) {
  return chat.msgs.slice(0, 40).map(m =>
    `${m.role === "kiddost" ? "KidDost" : "Customer"}: ${sanitizeExampleText(m.text)}`
  ).join("\n");
}

// Extract the "we engage the child with..." program description line from an example chat.
// Strips the age prefix so the AI uses the age from the conversation, not the example.
function extractProgramDescription(chat) {
  const line = chat.msgs.find(m =>
    m.role === "kiddost" && /we engage the child with/i.test(m.text)
  );
  if (!line) return null;
  const text = sanitizeExampleText(line.text);
  return text.replace(/^(?:[\w]+,\s*)?[Ff]or\s+[\d.]+(?:\.5)?\s*(?:year|month)?(?:\s*(?:year|month))?\s*old\s+(?:age\s+category\s+)?/i, "").trim();
}

// Scan ALL example chats and return the program description whose stated age is
// closest to childAge. Falls back to any chat with an "engage" line if none match.
function findProgramDescriptionForAge(childAge) {
  let best = null;
  let bestDiff = Infinity;

  for (const chat of EXAMPLE_CHATS) {
    const line = chat.msgs.find(m =>
      m.role === "kiddost" && /we engage the child with/i.test(m.text)
    );
    if (!line) continue;

    // Try to extract the age from the line e.g. "For 4 year old..." → 4
    const ageMatch = line.text.match(/[Ff]or\s+([\d.]+)(?:\.5)?\s*(?:year|month)?(?:\s*(?:year|month))?\s*old/i);
    if (ageMatch) {
      const lineAge = parseFloat(ageMatch[1]);
      const diff = Math.abs(lineAge - childAge);
      if (diff < bestDiff) {
        bestDiff = diff;
        const text = sanitizeExampleText(line.text);
        best = text.replace(/^(?:[\w]+,\s*)?[Ff]or\s+[\d.]+(?:\.5)?\s*(?:year|month)?(?:\s*(?:year|month))?\s*old\s+(?:age\s+category\s+)?/i, "").trim();
      }
    }
  }

  // Fallback: use any chat with an engage line
  if (!best) {
    for (const chat of EXAMPLE_CHATS) {
      const desc = extractProgramDescription(chat);
      if (desc) { best = desc; break; }
    }
  }

  return best;
}
// ────────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '95mb' }));
// Restrict CORS to the Vercel frontend origin
app.use(cors({
  origin: "https://kiddost-ai.vercel.app",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));
const PORT = process.env.PORT || 10000;

// Keys
const BOTSPACE_API_KEY = process.env.BOTSPACE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// VAPID setup for Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@kiddost.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory push subscription store { endpoint -> subscriptionObject }
const pushSubscriptions = new Map();

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Service-role client for server-side uploads (requires SUPABASE_SERVICE_ROLE_KEY env)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseService = null;
if (SUPABASE_SERVICE_ROLE_KEY) {
  supabaseService = createClient(process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// In-memory buffering to combine fragmented user messages per phone
const MESSAGE_BUFFER_DELAY_MS = 100; // ← change this to adjust how long to wait before sending to AI (in milliseconds)
const messageBuffers = {};
const messageTimers = {};

// In-memory OTP store for agent creation: { token -> { otp, expiresAt } }
const otpStore = {};

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

// Helper: generate AI response for a combined user message
async function handleAIResponse(fullPhone, combinedMessage) {
  try {
    // Fetch last 10 messages for conversation memory
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("phone", fullPhone)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("Supabase fetch error:", error);
    }

    const history = Array.isArray(data) ? data.reverse() : [];

    // Before generating AI response, check most recent message's ai_enabled flag
    const { data: last, error: lastErr } = await supabase
      .from("messages")
      .select("*")
      .eq("phone", fullPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) console.log("Supabase fetch error:", lastErr);

    if (last && last.ai_enabled === false) {
      console.log("AI disabled for this conversation (buffered)");
      return;
    }

    // ── STEP 1: Intent extraction ────────────────────────────────────────────
    // A small, cheap AI call that reads the full conversation context and decides:
    // - what the user is actually asking about (handles follow-ups like "For 4?")
    // - whether they're asking about activities/programs
    // - a good search query to find the right example chat
    let intent = { isAskingAboutActivities: false, searchQuery: combinedMessage, childAge: null };
    try {
      const intentRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a query classifier for a childcare service chatbot. Given a conversation, extract what the user is currently asking.
Return ONLY valid JSON with these fields:
- "isAskingAboutActivities": true if the user is asking what programs or activities are offered (including follow-up questions like "For 4?" after a prior activities question)
- "childAge": the child's age as a number if mentioned anywhere in the conversation (e.g. 3, 4, 5), or null if not mentioned
- "searchQuery": a short keyword phrase (3-6 words) to search for relevant past conversations. If asking about activities, include the child's age (e.g. "activities 4 year old", "activities 3 year old")
Consider the full conversation context when deciding intent.`
            },
            ...history,
            { role: "user", content: combinedMessage }
          ],
          temperature: 0,
          response_format: { type: "json_object" }
        },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" } }
      );
      intent = JSON.parse(intentRes.data.choices[0].message.content);
      console.log("[Intent]", intent);
    } catch (e) {
      console.log("[Intent] extraction failed, falling back:", e.message);
    }

    // ── STEP 2: Retrieve relevant example using the extracted search query ───
    const exampleChat = findBestExampleChat(intent.searchQuery || combinedMessage);
    // If we know the child's age, scan ALL chats for the closest age-matched description.
    // Otherwise fall back to the best matching chat's description.
    const programDescription = intent.isAskingAboutActivities
      ? (intent.childAge != null
          ? findProgramDescriptionForAge(intent.childAge)
          : extractProgramDescription(exampleChat))
      : null;
    // Prepend child's age to the injected activities so the AI uses the right age
    const childAgeLabel = intent.childAge ? `For a ${intent.childAge}-year-old, ` : "";
    const exampleBlock = exampleChat
      ? `\n\n---\nExample conversation (use for tone and style only):\n\`\`\`\n${formatExampleChat(exampleChat)}\n\`\`\`\n---`
      : "";

    // The system prompt now has all exact age-based activity scripts.
    // Do NOT inject example activities — they conflict with the system prompt scripts.
    const userMessageForAI = combinedMessage;

    const messagesForAI = [
      {
        role: "system",
        content:
          `You are a WhatsApp assistant for KidDost, a child engagement and tutoring service in Bangalore.

Your tone:
- Friendly, warm, and human-like (like a real WhatsApp agent)
- Slightly sales-oriented but never pushy
- Clear and concise (2–5 short lines max)
- Never robotic or overly formal
- NO emojis — ever

CRITICAL RULES:
- Always base your answer on the CURRENT conversation context
- DO NOT copy specific names, dates, prices, or availability from the example conversation
- If the user asks about availability (dates/tomorrow/etc), respond generally or ask for confirmation instead of assuming
- DO NOT use emojis in any response

IMPORTANT — if you are unsure or do not have enough information to answer confidently:
- Do NOT guess or make up an answer
- Reply with ONLY the single word: UNSURE
- Do not add any other text when you reply UNSURE

---
RESPONSE PLAYBOOK — these are guidelines, not word-for-word scripts. You have freedom to paraphrase naturally and adapt to the conversation context. Only include information that is relevant to what the customer actually asked.

PRICING / SERVICES / QUOTATION:
- Check the conversation history first. If the child's age was already mentioned, use it — do NOT ask again.
- If age is not known yet, naturally ask for the child's age — phrase it conversationally, e.g. "Could you share your child's age?" or "May I know how old your child is?" — do NOT start with "Sure,"
- Once age is known, give the appropriate activities response (paraphrasing is fine, keep the core activities accurate):
  • Under 6 months: Explain this is too young and you might not be the right fit.
  • 6m–under 1 year: Explain the age category starts from 1 year, but you've made exceptions for infants — verbal interaction, rhymes, flashcards. Clarify no massage/bathing. Female graduates, English interaction.
  • Age 1 to under 2 (including 1.5 years, 18 months): Verbal interaction, age-appropriate puzzles, flashcards, rhymes, storybook reading, park outings.
  • Age 2: Verbal interaction, puzzles, rhymes, simple art & craft, storybook reading, shapes/colours/numbers, park outings.
  • Age 3: Puzzles, memory games, art & craft, brain-boosting activities, storybook reading, phonics, writing practice, park outings.
  • Age 4 to 8: Puzzles, memory games, art & craft, brain-boosting activities, storybook reading, worksheets, study help if needed, park outings.
  • Age above 8: Apologise — services are for children up to 8 years, you are not the right fit.
- After the activities (for ages 8 and below), write [PRICING_IMAGE] on its own line so the pricing image is sent.
- After the image, include the pricing context — use judgment on how much to say based on what they asked:
  • If they asked about full pricing/services: mention the trial session at ₹500/hour.
  • If they just asked to see the pricing table or asked a follow-up: just briefly say "Please refer to the pricing details above."
- End with "Feel free to let us know if you have any questions." as a separate line.
- Do NOT add nanny disclaimer unless the user specifically asked about nanny services.
- Do NOT send [PRICING_IMAGE] unless the conversation is specifically about pricing, services, or packages.

NANNY SERVICES (only when user asks about nanny/caretaker/babysitter):
- Ask child's age, give age-appropriate activities, then write [PRICING_IMAGE], then clarify: we don't provide nanny services — team members are female graduates/students, English interaction.

MONTHLY PACKAGES (only when user asks about packages/monthly plans):
- Write [MONTH_IMAGE] on its own line, then explain the package flexibility (bundle of sessions, discounted rate, can be used over 1–3 months).
- End with "Feel free to let us know if you have any questions."

MEMBER QUALIFICATIONS:
- Motivated, compassionate female graduates/students passionate about teaching. Comprehensive in-house training.

SAME MEMBER EVERY TIME:
- We keep 2–3 members per account for continuity, accounting for short and long leaves.

OTHER BABY WORK (feeding, cleaning, etc.):
- Scope is limited to engaging children through fun and learning. Can encourage snacks if child is not a fussy eater.

TOO EXPENSIVE / OUT OF BUDGET:
- Thank them for considering, invite them to reach out for ad-hoc support.

TIME SLOT REQUEST:
- "Sure, allow me to check the slot availability and come back to you."

NEW SESSION / LOCATION:
- Ask them to share their location to confirm service availability.
---

Goal: Make the user feel like they are chatting with a real human agent and move them towards booking a trial session.` +
          (KIDDOST_WEBSITE_CONTENT ? `\n\n---\nKidDost background info (philosophy, contact, general info — do NOT use for listing activities):\n${KIDDOST_WEBSITE_CONTENT}\n---` : "") +
          exampleBlock
      },
      ...history,
      { role: "user", content: userMessageForAI }
    ];

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: messagesForAI,
        temperature: 0
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = aiResponse.data.choices[0].message.content;
    console.log("AI Reply (buffered):", aiReply);

    // If AI is unsure, notify agents instead of replying to user
    if (aiReply.trim().toUpperCase() === "UNSURE") {
      console.log("[AI] UNSURE — sending agent notification, not replying to user");
      await sendPushToAll({
        title: "Agent needed",
        body: `AI couldn't answer for ${fullPhone} — message: "${combinedMessage.slice(0, 80)}"`,
        phone: fullPhone,
        icon: "/icon-192.png"
      });
      return;
    }

    // Helper: send a text message via BotSpace and save to DB
    const SERVER_URL = process.env.SERVER_URL || 'https://kiddost-ai.onrender.com';
    const sendAIText = async (text) => {
      await supabase.from("messages").insert({
        phone: fullPhone, role: "assistant", content: text, sender: "ai", agent: null, ai_enabled: true
      });
      await axios.post(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message`,
        { name: "User", phone: fullPhone, text },
        { params: { apiKey: BOTSPACE_API_KEY }, headers: { "Content-Type": "application/json" } }
      );
    };
    const sendAIImage = async (filename) => {
      const mediaUrl = `${SERVER_URL}/static/${filename}`;
      await axios.post(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-media-message?apiKey=${BOTSPACE_API_KEY}`,
        { name: 'KidDost', phone: fullPhone, mediaUrl, mediaType: 'image', label: '' },
        { headers: { 'Content-Type': 'application/json' } }
      );
    };

    // Split reply on image markers and send segments in order
    const IMAGE_MARKERS = { '[PRICING_IMAGE]': 'pricing.jpeg', '[MONTH_IMAGE]': 'month.jpeg' };
    const MARKER_PATTERN = /\[(PRICING_IMAGE|MONTH_IMAGE)\]/g;
    const FEEL_FREE_PATTERN = /feel free to let us know if you have any questions\.?/i;
    const FEEL_FREE_TEXT = 'Feel free to let us know if you have any questions.';
    const parts = aiReply.split(MARKER_PATTERN);
    // parts alternates: text, markerName, text, markerName, text ...
    let pricingImageSent = false;
    let shouldSendFeelFree = false;
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i].trim();
      if (!part) continue;
      const filename = IMAGE_MARKERS[`[${part}]`];
      if (filename) {
        if (filename === 'pricing.jpeg') pricingImageSent = true;
        await sendAIImage(filename);
        await new Promise(r => setTimeout(r, 600));
      } else {
        // Extract "Feel free" sentence to always send as its own final message
        if (FEEL_FREE_PATTERN.test(part)) {
          shouldSendFeelFree = true;
          part = part.replace(FEEL_FREE_PATTERN, '').trim();
        }
        // If the AI says "Please refer to our pricing details" but forgot the image marker, send image first
        if (/please refer to our pricing details/i.test(part) && !pricingImageSent) {
          pricingImageSent = true;
          await sendAIImage('pricing.jpeg');
          await new Promise(r => setTimeout(r, 600));
        }
        if (part) {
          await sendAIText(part);
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    // Send "Feel free" as its own final message
    if (shouldSendFeelFree) {
      await new Promise(r => setTimeout(r, 400));
      await sendAIText(FEEL_FREE_TEXT);
    }

    console.log("Buffered message sent successfully");
  } catch (err) {
    console.error("handleAIResponse error", err.response?.data || err.message || err);
  }
}

// Helper: upload external media URL to BotSpace and return mediaId
async function uploadToBotspace(mediaUrl) {
  try {
    const resp = await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/media/upload?apiKey=${BOTSPACE_API_KEY}`,
      { url: mediaUrl },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return resp?.data?.data?.id || null;
  } catch (err) {
    console.error('uploadToBotspace error', err.response?.data || err.message || err);
    return null;
  }
}

// Serve the KidDost welcome flyer image
app.use('/static', express.static(__dirname));

// Send 3-part welcome sequence to a new user
async function sendWelcome(fullPhone) {
  const sendText = async (text) => {
    await supabase.from('messages').insert({
      phone: fullPhone, role: 'assistant', content: text, sender: 'ai', agent: null, ai_enabled: true
    });
    await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message`,
      { name: 'KidDost', phone: fullPhone, text },
      { params: { apiKey: BOTSPACE_API_KEY }, headers: { 'Content-Type': 'application/json' } }
    );
  };
  try {
    // 1. Greeting
    await sendText('Hi, thank you for contacting KidDost.');
    await new Promise(r => setTimeout(r, 800));
    // 2. Flyer image (send via BotSpace; save a placeholder to DB so dashboard shows it)
    const SERVER_URL = process.env.SERVER_URL || 'https://kiddost-ai.onrender.com';
    const imageUrl = `${SERVER_URL}/static/image.png`;
    await supabase.from('messages').insert({
      phone: fullPhone, role: 'assistant', content: '', media_url: imageUrl, sender: 'ai', agent: null, ai_enabled: true
    });
    await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-media-message?apiKey=${BOTSPACE_API_KEY}`,
      { name: 'KidDost', phone: fullPhone, mediaUrl: imageUrl, mediaType: 'image', label: '' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    await new Promise(r => setTimeout(r, 800));
    // 3. Follow-up
    await sendText('Feel free to let us know if you have any questions.');
    console.log('[welcome] sent to', fullPhone);
  } catch (e) {
    console.error('[welcome] failed:', e.response?.data || e.message);
  }
}

// Health check
app.get("/", (req, res) => {
  res.send("Kiddost AI running");
});

// List all active agents (names + ids only, no PINs) — used by login profile picker
app.get("/agents", async (req, res) => {
  const profiles = [];
  if (supabaseService) {
    const { data } = await supabaseService
      .from('agents')
      .select('id, name')
      .order('created_at', { ascending: true });
    if (data) profiles.push(...data);
  }
  // Always include Admin card if DASHBOARD_PIN is configured
  if (process.env.DASHBOARD_PIN) {
    profiles.push({ id: 'admin', name: 'Admin' });
  }
  return res.json({ agents: profiles });
});

// Agent login — accepts agentId to restrict hash lookup to that specific account
app.post("/agent-login", async (req, res) => {
  const { pin, agentId } = req.body;
  if (!pin || typeof pin !== "string") return res.status(400).json({ error: "missing_pin" });
  const hashed = hashPin(pin.trim());

  // Admin shortcut (DASHBOARD_PIN)
  if (agentId === 'admin' || !agentId) {
    const DASHBOARD_PIN = process.env.DASHBOARD_PIN;
    if (DASHBOARD_PIN && pin.trim() === DASHBOARD_PIN) {
      return res.json({ success: true, name: 'Admin' });
    }
    if (agentId === 'admin') return res.status(401).json({ error: 'invalid_pin' });
  }

  // Check agents table — if agentId given, restrict to that row only
  if (supabaseService) {
    let query = supabaseService
      .from('agents')
      .select('id, name')
      .eq('pin_hash', hashed);
    if (agentId && agentId !== 'admin') query = query.eq('id', agentId);
    const { data: agent } = await query.maybeSingle();
    if (agent) return res.json({ success: true, name: agent.name, id: agent.id });
  }

  return res.status(401).json({ error: 'invalid_pin' });
});

// Backward compat alias
app.post("/verify-pin", async (req, res) => {
  const { pin } = req.body;
  const DASHBOARD_PIN = process.env.DASHBOARD_PIN;
  if (DASHBOARD_PIN && pin === DASHBOARD_PIN) return res.json({ success: true, name: 'Admin' });
  return res.status(401).json({ error: 'invalid_pin' });
});

// Request OTP to create a new agent — sends to ADMIN_PHONE via BotSpace WhatsApp
app.post("/request-agent-otp", async (req, res) => {
  const ADMIN_PHONE = process.env.ADMIN_PHONE;
  if (!ADMIN_PHONE) return res.status(500).json({ error: 'no_admin_phone_configured' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const token = crypto.randomBytes(16).toString('hex');
  otpStore[token] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  try {
    await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message`,
      { name: 'Kiddost', phone: ADMIN_PHONE, text: `🔐 Kiddost Agent OTP: *${otp}*\n\nSomeone is requesting to add a new agent to the dashboard. If this was you, enter this code. Expires in 10 minutes.` },
      { params: { apiKey: BOTSPACE_API_KEY }, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to send OTP via BotSpace', err.response?.data || err.message);
    return res.status(500).json({ error: 'failed_to_send_otp' });
  }

  return res.json({ success: true, token });
});

// Create new agent — verify OTP then insert into agents table
app.post("/create-agent", async (req, res) => {
  const { token, otp, name, pin } = req.body;
  if (!token || !otp || !name || !pin) return res.status(400).json({ error: 'missing_params' });
  if (!supabaseService) return res.status(500).json({ error: 'missing_service_role_key' });

  const stored = otpStore[token];
  if (!stored) return res.status(400).json({ error: 'invalid_token' });
  if (Date.now() > stored.expiresAt) {
    delete otpStore[token];
    return res.status(400).json({ error: 'otp_expired' });
  }
  if (stored.otp !== String(otp).trim()) return res.status(401).json({ error: 'invalid_otp' });

  delete otpStore[token];

  const pinHash = hashPin(String(pin).trim());
  const safeName = String(name).trim().slice(0, 50);

  const { data: created, error: insertError } = await supabaseService
    .from('agents')
    .insert({ name: safeName, pin_hash: pinHash, active: true })
    .select('id')
    .single();

  if (insertError) {
    console.error('create-agent insert error', insertError);
    return res.status(500).json({ error: 'db_error', detail: insertError.message });
  }

  return res.json({ success: true, name: safeName, id: created?.id ?? null });
});

// Delete an agent account — requires matching agentId + PIN
app.post('/delete-agent', async (req, res) => {
  const { agentId, pin } = req.body;
  if (!agentId || !pin || typeof pin !== 'string') return res.status(400).json({ error: 'missing_fields' });
  if (agentId === 'admin') return res.status(403).json({ error: 'cannot_delete_admin' });
  if (!supabaseService) return res.status(500).json({ error: 'missing_service_role_key' });

  const hashed = hashPin(pin.trim());
  const { data: agent } = await supabaseService
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('pin_hash', hashed)
    .maybeSingle();

  if (!agent) return res.status(401).json({ error: 'invalid_pin' });

  await supabaseService.from('agents').delete().eq('id', agentId);
  return res.json({ ok: true });
});

// In-memory store for last 20 webhook bodies (for debugging)
const recentWebhooks = [];
app.get("/debug-webhooks", (req, res) => {
  res.json({ count: recentWebhooks.length, webhooks: recentWebhooks });
});

// Push notification endpoints
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

app.post('/push-subscribe', (req, res) => {
  const { subscription, agent } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid_subscription' });
  pushSubscriptions.set(subscription.endpoint, { subscription, agent });
  console.log(`[push] subscribed: ${agent} (${pushSubscriptions.size} total)`);
  res.json({ ok: true });
});

app.post('/push-unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) pushSubscriptions.delete(endpoint);
  res.json({ ok: true });
});

async function sendPushToAll(payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const dead = [];
  for (const [endpoint, { subscription }] of pushSubscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) dead.push(endpoint);
      else console.error('[push] send error:', e.message);
    }
  }
  dead.forEach(ep => pushSubscriptions.delete(ep));
}

// Shared contacts (stored in Supabase so all agents see the same names)
app.get('/contacts', async (req, res) => {
  const { data, error } = await supabase.from('contacts').select('phone, name, notes, labels');
  if (error) return res.status(500).json({ error: error.message });
  const map = {};
  for (const row of (data || [])) map[row.phone] = { name: row.name || '', notes: row.notes || '', labels: row.labels || [] };
  res.json({ contacts: map });
});

app.post('/contacts', async (req, res) => {
  const { phone, name, notes } = req.body;
  if (!phone) return res.status(400).json({ error: 'missing phone' });
  const { error } = await supabase.from('contacts').upsert({ phone, name: name || '', notes: notes || '' }, { onConflict: 'phone' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Label endpoints — persist to Supabase and proxy add/remove to BotSpace
app.post('/label', async (req, res) => {
  const { phone, label } = req.body;
  if (!phone || !label) return res.status(400).json({ error: 'missing phone or label' });

  // Persist label to Supabase contacts table
  const { data: existing } = await supabase.from('contacts').select('labels').eq('phone', phone).maybeSingle();
  const currentLabels = existing?.labels || [];
  if (!currentLabels.includes(label)) {
    await supabase.from('contacts').upsert({ phone, labels: [...currentLabels, label] }, { onConflict: 'phone' });
  }

  // Also send to BotSpace if we have the conversationId
  const { data: conv } = await supabase.from('conversations').select('conversation_id').eq('phone', phone).maybeSingle();
  const conversationId = conv?.conversation_id;
  if (conversationId) {
    try {
      await axios.post(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/conversation/${conversationId}/labels?apiKey=${BOTSPACE_API_KEY}`,
        { labels: [label] },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('[label] BotSpace add error', e?.response?.data || e.message);
    }
  }
  res.json({ ok: true });
});

app.delete('/label', async (req, res) => {
  const { phone, label } = req.query;
  if (!phone || !label) return res.status(400).json({ error: 'missing phone or label' });

  // Remove from Supabase
  const { data: existing } = await supabase.from('contacts').select('labels').eq('phone', phone).maybeSingle();
  const updatedLabels = (existing?.labels || []).filter(l => l !== label);
  await supabase.from('contacts').upsert({ phone, labels: updatedLabels }, { onConflict: 'phone' });

  // Also remove from BotSpace
  const { data: conv } = await supabase.from('conversations').select('conversation_id').eq('phone', phone).maybeSingle();
  const conversationId = conv?.conversation_id;
  if (conversationId) {
    try {
      await axios.delete(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/conversation/${conversationId}/labels/${encodeURIComponent(label)}?apiKey=${BOTSPACE_API_KEY}`
      );
    } catch (e) {
      console.error('[label] BotSpace remove error', e?.response?.data || e.message);
    }
  }
  res.json({ ok: true });
});

app.delete('/reset-conversation', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'missing phone' });
  const { error: msgErr } = await supabase.from('messages').delete().eq('phone', phone);
  if (msgErr) return res.status(500).json({ error: msgErr.message });
  // Also remove from conversations table so the welcome flow re-triggers on next message
  const { error: convErr } = await supabase.from('conversations').delete().eq('phone', phone);
  if (convErr) return res.status(500).json({ error: convErr.message });
  res.json({ ok: true, message: `Cleared conversation history for ${phone}` });
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Store for debug inspection
    recentWebhooks.unshift({ ts: new Date().toISOString(), body });
    if (recentWebhooks.length > 20) recentWebhooks.pop();

    console.log("Full incoming body:");
    console.log(JSON.stringify(body, null, 2));
    console.log('[webhook] event:', body?.event, '| type:', body?.type, '| status:', body?.status || body?.payload?.status);

    // Handle delivery / status webhooks from BotSpace / WhatsApp
    // Catch any event that carries a status field or has status-related event name
    const isStatusEvent = body?.event === 'delivery-update' ||
      body?.event === 'message-status' || body?.event === 'message-delivered' ||
      body?.event === 'message-read' || body?.event === 'message-seen' ||
      body?.event === 'status' || body?.type === 'status' ||
      (body?.payload?.status && body?.direction === 'outgoing') ||
      (body?.status && body?.direction === 'outgoing');

    if (isStatusEvent) {
      const messageId = body?.id || body?.messageId || body?.message_id || body?.payload?.messageId || body?.payload?.message_id || body?.payload?.id;
      const rawStatus = body?.status || body?.payload?.status || body?.delivery_status || body?.payload?.delivery_status;
      // Normalise to consistent lowercase values
      const statusMap = { delivered: 'delivered', delivery: 'delivered', read: 'read', seen: 'read', sent: 'sent', accepted: 'sent', enqueued: 'sent' };
      const status = rawStatus ? (statusMap[String(rawStatus).toLowerCase()] || String(rawStatus).toLowerCase()) : null;
      if (messageId && status) {
        try {
          await supabase
            .from("messages")
            .update({ status })
            .eq("whatsapp_id", messageId);
          console.log(`Updated message status for ${messageId} -> ${status}`);
        } catch (e) {
          console.error("Failed to update message status", e?.message || e);
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Extract phone info
    const countryCode = body?.phone?.countryCode;
    const phone = body?.phone?.phone;
    if (!countryCode || !phone) {
      console.log("Missing phone info");
      return res.status(200).json({ ok: true });
    }

    const fullPhone = `+${countryCode}${phone}`;

    // Safely extract message or media
    let message = null;
    let mediaUrl = null;
    let incomingContentType = null;
    if (body.payload?.type === 'text') {
      message = body.payload?.payload?.text || null;
    } else if (body.payload?.type === 'media') {
      mediaUrl = body.payload?.payload?.url || null;
      incomingContentType = body.payload?.payload?.contentType || null;
    }

    console.log("Extracted message:", message);
    console.log("Extracted media:", mediaUrl);
    console.log("From:", fullPhone);

    if (!message && !mediaUrl) {
      console.log("Missing required fields or empty payload");
      return res.status(200).json({ ok: true });
    }

    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("phone")
      .eq("phone", fullPhone)
      .maybeSingle();

    const botspaceConversationId = body?.customer?.id || null;

    const isNewUser = !existingConversation;
    if (isNewUser) {
      await supabase.from("conversations").insert({
        phone: fullPhone,
        conversation_id: botspaceConversationId
      });
      // Trigger welcome sequence for brand-new users (don't await — fire and forget)
      sendWelcome(fullPhone).catch(e => console.error('[welcome] error', e.message));
    } else if (botspaceConversationId) {
      await supabase.from("conversations").update({ conversation_id: botspaceConversationId }).eq("phone", fullPhone);
    }

    // Determine previous AI state for this conversation
    let lastBefore = null;
    try {
      const { data: lb, error: lbErr } = await supabase
        .from("messages")
        .select("*")
        .eq("phone", fullPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lbErr) lastBefore = lb;
    } catch (e) {
      lastBefore = null;
    }

    const aiEnabledForInsert = lastBefore && typeof lastBefore.ai_enabled !== 'undefined' ? lastBefore.ai_enabled : true;

    // If incoming media URL is provided, try to fetch it and store in Supabase storage
    let storedMediaUrl = mediaUrl || null;
    if (mediaUrl && supabaseService) {
      try {
        const fetchResp = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(fetchResp.data);
        // Prefer the contentType from the BotSpace webhook payload (accurate) over the HTTP header (often octet-stream)
        const contentType = incomingContentType || (fetchResp.headers['content-type'] !== 'application/octet-stream' ? fetchResp.headers['content-type'] : null) || 'application/octet-stream';
        const safePhone = String(fullPhone).replace(/^\+/, '');
        const ext = (contentType.split('/')[1] || '').split(';')[0].split('+')[0];
        const safeExt = ext ? `.${ext}` : '';
        const safeName = `incoming_${Date.now()}${safeExt}`;
        const path = `${safePhone}/${safeName}`;

        const { error: uploadErr } = await supabaseService.storage.from('media').upload(path, buffer, { cacheControl: '3600', upsert: false, contentType });
        if (uploadErr) {
          console.error('service upload error (incoming media)', uploadErr);
        } else {
          const publicRes = supabaseService.storage.from('media').getPublicUrl(path);
          storedMediaUrl = publicRes?.data?.publicUrl || storedMediaUrl;
        }
      } catch (e) {
        console.error('failed to fetch/upload incoming media', e.response?.data || e.message || e);
      }
    }

    // Save user message (preserve ai_enabled if conversation previously disabled)
    const { error: userInsertError } = await supabase.from("messages").insert({
      phone: fullPhone,
      role: "user",
      content: message || "",
      sender: "user",
      media_url: storedMediaUrl || null,
      ai_enabled: aiEnabledForInsert
    });
    if (userInsertError) console.error('/webhook user insert error', userInsertError.message, { storedMediaUrl });

    // Send push notification to all subscribed agent dashboards
    const senderName = body?.customer?.name?.trim() || fullPhone;
    const pushText = message || (mediaUrl ? '📎 Media message' : 'New message');
    sendPushToAll({
      title: `${senderName}`,
      body: pushText,
      phone: fullPhone,
      icon: '/icon-192.png'
    }).catch(() => {});
 
    // If AI is disabled for this conversation, skip buffering/respon
    const { data: last, error: lastErr } = await supabase
      .from("messages")
      .select("*")
      .eq("phone", fullPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.log("Supabase fetch error:", lastErr);
    }

    if (last && last.ai_enabled === false) {
      console.log("AI disabled for this conversation");
      return res.status(200).json({ success: true, ai_skipped: true });
    }

    // Only buffer text messages for AI (ignore pure media for AI, and skip for brand-new users)
    if (message && !isNewUser) {
      if (!messageBuffers[fullPhone]) messageBuffers[fullPhone] = [];
      messageBuffers[fullPhone].push(message);

      // clear previous timer if any
      if (messageTimers[fullPhone]) {
        clearTimeout(messageTimers[fullPhone]);
      }

      // wait MESSAGE_BUFFER_DELAY_MS before sending combined text to AI
      messageTimers[fullPhone] = setTimeout(async () => {
        const combined = (messageBuffers[fullPhone] || []).join(" ").trim();
        // reset buffer
        messageBuffers[fullPhone] = [];
        try {
          if (combined) {
            await handleAIResponse(fullPhone, combined);
          }
        } catch (e) {
          console.error('buffered AI handler error', e?.message || e);
        }
      }, MESSAGE_BUFFER_DELAY_MS);
    }

    // respond quickly to webhook sender
    return res.status(200).json({ success: true, buffered: !!message });

  } catch (error) {
    console.log("=== ERROR ===");
    console.log(error.response?.data || error.message);
    res.status(200).json({ error: true });
  }
});
// List approved WhatsApp templates from BotSpace
app.get('/templates', async (req, res) => {
  try {
    const resp = await axios.get(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/templates`,
      { params: { apiKey: BOTSPACE_API_KEY } }
    );
    // Return raw response so client can inspect structure
    console.log('[templates] raw BotSpace response:', JSON.stringify(resp.data).slice(0, 1000));
    res.json(resp.data);
  } catch (e) {
    const d1 = e?.response?.data || e.message;
    console.error('[templates] URL1 error status:', e?.response?.status, 'body:', JSON.stringify(d1));
    // Try alternate URL if first fails
    try {
      const resp2 = await axios.get(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/templates`,
        { params: { apiKey: BOTSPACE_API_KEY } }
      );
      console.log('[templates] alt URL raw response:', JSON.stringify(resp2.data).slice(0, 1000));
      res.json(resp2.data);
    } catch (e2) {
      const d2 = e2?.response?.data || e2.message;
      console.error('[templates] URL2 error status:', e2?.response?.status, 'body:', JSON.stringify(d2));
      res.status(500).json({ error: 'failed_to_fetch_templates', detail: d1, alt_detail: d2 });
    }
  }
});

// Send a WhatsApp template message and save it to the messages table
app.post('/send-template', async (req, res) => {
  const { phone, name, templateId, variables, mediaVariable, agent: agentName } = req.body;
  if (!phone || !templateId) return res.status(400).json({ error: 'missing fields' });

  let botResp;
  try {
    const payload = { name: name || '', phone, templateId, variables: variables || [] };
    if (mediaVariable) payload.mediaVariable = mediaVariable;
    botResp = await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-message`,
      payload,
      { params: { apiKey: BOTSPACE_API_KEY }, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[send-template] BotSpace error', e?.response?.data || e.message);
    return res.status(500).json({ error: 'botspace_error', detail: e?.response?.data || e.message });
  }

  const d = botResp?.data;
  const whatsappId = d?.data?.id || d?.data?.messageId || d?.messageId || d?.id || null;

  const TEMPLATE_PREVIEWS = {
    session: 'Hi, would you like to go ahead with the session today?',
  };
  const preview = TEMPLATE_PREVIEWS[templateId] || `[Template: ${templateId}]${variables?.length ? ' ' + variables.join(', ') : ''}`;

  try {
    await supabase.from('messages').insert({
      phone,
      role: 'assistant',
      content: preview,
      sender: 'agent',
      agent: agentName || 'Agent',
      ai_enabled: false,
      whatsapp_id: whatsappId,
      status: 'sent',
    });
    await supabase.from('conversations').update({ ai_paused: true }).eq('phone', phone);
  } catch (dbErr) {
    console.error('[send-template] DB error', dbErr?.message || dbErr);
  }

  res.json({ ok: true, whatsapp_id: whatsappId });
});

app.post("/agent-send", async (req, res) => {
  try {

    const { phone, message } = req.body;

    console.log("Agent message:", phone, message);

    // Send WhatsApp message through BotSpace and capture returned message id/status
    const agentName = req.body.agent || "Daksh";
    let botResp;
    try {
      botResp = await axios.post(
        `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message`,
        {
          phone: phone,
          text: message
        },
        {
          params: {
            apiKey: BOTSPACE_API_KEY
          }
        }
      );
    } catch (err) {
      console.log("BotSpace send error:", err.response?.data || err.message || err);
      return res.status(500).json({ error: true, detail: "botspace_send_failed" });
    }

    // Attempt to extract a whatsapp message id and status from BotSpace response
    console.log('BotSpace full response data:', JSON.stringify(botResp?.data));
    const d = botResp?.data;
    const whatsappId =
      d?.messageId || d?.message_id || d?.id ||
      d?.data?.messageId || d?.data?.message_id || d?.data?.id ||
      d?.message?.id || d?.message?.messageId ||
      d?.payload?.messageId || d?.payload?.id ||
      null;
    const status = d?.status || d?.data?.status || "sent";

    // Save message to database with whatsapp id and status
    try {
      await supabase.from("messages").insert({
        phone: phone,
        role: "assistant",
        content: message,
        sender: "agent",
        agent: agentName,
        ai_enabled: false,
        whatsapp_id: whatsappId,
        status: status
      });

      // Also update conversations table flag for compatibility
      await supabase
        .from("conversations")
        .update({ ai_paused: true })
        .eq("phone", phone);
    } catch (dbErr) {
      console.error("Failed to insert agent message into supabase", dbErr?.message || dbErr);
    }

    if (whatsappId) console.log('[agent-send] whatsapp_id captured:', whatsappId, 'status:', status);

    res.json({ success: true, whatsapp_id: whatsappId, status });

  } catch (err) {

    console.log("Agent send error:", err.response?.data || err.message);

    res.status(500).json({
      error: true
    });

  }
});

// Endpoint to send media messages from agent and record them
app.post("/agent-send-media", async (req, res) => {
  const { phone, mediaUrl, caption } = req.body;

  console.log("/agent-send-media body:", req.body);

  try {
    // Auto-detect mediaType from URL extension
    function detectMediaType(url) {
      const clean = (url || '').split('?')[0].toLowerCase();
      if (/\.(mp4|mov|avi|mkv|webm|3gp)$/.test(clean)) return 'video';
      if (/\.(mp3|ogg|wav|m4a|aac)$/.test(clean)) return 'audio';
      if (/\.pdf$/.test(clean)) return 'document';
      return 'image'; // default
    }
    const payload = {
      name: "Agent",
      phone: phone,
      mediaUrl: mediaUrl,
      mediaType: detectMediaType(mediaUrl),
      label: caption || ""
    };

    console.log('BOTSPACE MEDIA PAYLOAD', payload);

    const response = await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-media-message?apiKey=${BOTSPACE_API_KEY}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('BOTSPACE RESPONSE', response.data);

    const { data: insertData, error: insertError } = await supabase.from("messages").insert({
      phone: phone,
      role: "assistant",
      sender: "agent",
      content: caption || "",
      media_url: mediaUrl,
      whatsapp_id: response?.data?.data?.id || response?.data?.data?.messageId || response?.data?.messageId || response?.data?.id || response?.data?.message_id || null
    });
    console.log('/agent-send-media insert result', { insertError, insertData });

    const mediaMsgId = response?.data?.data?.id || response?.data?.data?.messageId || response?.data?.messageId || response?.data?.id || null;
    if (mediaMsgId) console.log('[agent-send-media] whatsapp_id captured:', mediaMsgId);

    res.json({ success: true });
  } catch (err) {
    console.error('BotSpace send-media error', err.response?.data || err);
    res.status(500).json({ error: 'Failed to send media' });
  }
});

// Ensure the 'media' storage bucket exists (idempotent) — useful when client can't upload
app.post('/ensure-media-bucket', async (req, res) => {
  try {
    const bucketName = 'media';
    // try to create bucket; if it exists, Supabase returns an error which we ignore
    const { data, error } = await supabase.storage.createBucket(bucketName, { public: true });
    if (error && !/already exists/i.test(String(error.message || ''))) {
      console.error('createBucket error', error.message || error);
      return res.status(500).json({ error: true, detail: 'create_bucket_failed' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('/ensure-media-bucket error', err.message || err);
    return res.status(500).json({ error: true });
  }
});

// Server-side upload endpoint: accepts base64 file, uploads to Supabase storage using service role, returns public URL
app.post('/upload-media-server', express.json({ limit: '100mb' }), async (req, res) => {
  try {
    // Ensure CORS headers present for browsers (handle cases where middleware may not run)
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    if (!supabaseService) return res.status(500).json({ error: 'missing_service_role_key' });
    const { fileBase64, fileName, phone, fileType } = req.body;
    if (!fileBase64 || !fileName || !phone) return res.status(400).json({ error: 'missing_params' });

    // sanitize phone for storage path: remove leading + to avoid issues with some fetchers
    const safePhone = String(phone).replace(/^\+/, '');
    const safeName = String(fileName).replace(/[^a-zA-Z0-9.\-_\.]/g, '_');
    const path = `${safePhone}/${Date.now()}_${safeName}`;

    const buffer = Buffer.from(fileBase64, 'base64');

    const uploadOptions = { cacheControl: '3600', upsert: false, contentType: fileType || 'application/octet-stream' };

    const { error: uploadError } = await supabaseService.storage.from('media').upload(path, buffer, uploadOptions);
    if (uploadError) {
      console.error('service upload error', uploadError);
      return res.status(500).json({ error: 'upload_failed', detail: uploadError.message || uploadError });
    }

    const publicRes = supabaseService.storage.from('media').getPublicUrl(path);
    const publicUrl = publicRes?.data?.publicUrl || null;
    return res.json({ success: true, publicUrl });
  } catch (err) {
    console.error('/upload-media-server error', err.message || err);
    return res.status(500).json({ error: true });
  }
});

// Toggle AI on/off via system message
app.post('/toggle-ai', async (req, res) => {
  try {
    const { phone, ai_enabled } = req.body;
    if (typeof phone === 'undefined' || typeof ai_enabled === 'undefined') {
      return res.status(400).json({ error: 'missing phone or ai_enabled' });
    }

    // Insert a system message so the next webhook message inherits the correct ai_enabled state
    await supabase.from("messages").insert({
      phone: phone,
      role: "system",
      content: ai_enabled ? "AI resumed" : "AI paused by agent",
      sender: "system",
      ai_enabled: !!ai_enabled
    });

    // Also update conversations table flag for compatibility
    await supabase.from('conversations').upsert({ phone, ai_paused: !ai_enabled });

    res.json({ success: true });
  } catch (err) {
    console.error('toggle-ai error', err.message || err);
    res.status(500).json({ error: true });
  }
});
// Debug endpoint: return recent messages (for troubleshooting frontend visibility)
app.get('/debug-messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, phone, content, media_url, whatsapp_id, status, sender, role, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return res.json({ data, error });
  } catch (e) {
    console.error('/debug-messages error', e?.message || e);
    return res.status(500).json({ error: true });
  }
});

// Debug endpoint: show exactly what prompt would be sent to the AI for a given phone + test message
app.get('/debug-prompt', async (req, res) => {
  try {
    const { phone, message } = req.query;
    if (!phone || !message) return res.status(400).json({ error: 'pass ?phone=+91...&message=...' });

    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(10);
    const history = Array.isArray(data) ? data.reverse() : [];

    const exampleChat = findBestExampleChat(message);
    const programDescription = exampleChat ? extractProgramDescription(exampleChat) : null;
    const exampleBlock = exampleChat
      ? `\n\n---\n${programDescription ? `KIDDOST PROGRAM DESCRIPTION (extracted from a real conversation — when the user asks about activities or programs, use this description word for word, do not swap these activities for others):\n"${programDescription}"\n\n` : ""}Full example conversation (use for tone and style only):\n\`\`\`\n${formatExampleChat(exampleChat)}\n\`\`\`\n\nDO NOT copy from the example: specific names, dates, prices, locations, or availability.\n---`
      : "";

    const systemPrompt = `You are a WhatsApp assistant for KidDost, a child engagement and tutoring service in Bangalore.

Your tone:
- Friendly, warm, and human-like (like a real WhatsApp agent)
- Slightly sales-oriented but never pushy
- Clear and concise (2–5 short lines max)
- Never robotic or overly formal
- NO emojis — ever

CRITICAL RULES:
- Always base your answer on the CURRENT conversation context
- Use ONLY the activities mentioned in the example conversation below — NEVER invent activities not found there
- DO NOT copy specific names, dates, prices, or availability from the example conversation
- If the user asks about availability (dates/tomorrow/etc), respond generally or ask for confirmation instead of assuming
- DO NOT use emojis in any response

IMPORTANT — if you are unsure or do not have enough information to answer confidently:
- Do NOT guess or make up an answer
- Reply with ONLY the single word: UNSURE
- Do not add any other text when you reply UNSURE

---
RESPONSE PLAYBOOK — these are guidelines, not word-for-word scripts. You have freedom to paraphrase naturally and adapt to the conversation context. Only include information that is relevant to what the customer actually asked.

PRICING / SERVICES / QUOTATION:
- Check the conversation history first. If the child's age was already mentioned, use it — do NOT ask again.
- If age is not known yet, naturally ask for the child's age — phrase it conversationally, e.g. "Could you share your child's age?" or "May I know how old your child is?" — do NOT start with "Sure,"
- Once age is known, give the appropriate activities response (paraphrasing is fine, keep the core activities accurate):
  • Under 6 months: Explain this is too young and you might not be the right fit.
  • 6m–under 1 year: Explain the age category starts from 1 year, but you've made exceptions for infants — verbal interaction, rhymes, flashcards. Clarify no massage/bathing. Female graduates, English interaction.
  • Age 1 to under 2 (including 1.5 years, 18 months): Verbal interaction, age-appropriate puzzles, flashcards, rhymes, storybook reading, park outings.
  • Age 2: Verbal interaction, puzzles, rhymes, simple art & craft, storybook reading, shapes/colours/numbers, park outings.
  • Age 3: Puzzles, memory games, art & craft, brain-boosting activities, storybook reading, phonics, writing practice, park outings.
  • Age 4 to 8: Puzzles, memory games, art & craft, brain-boosting activities, storybook reading, worksheets, study help if needed, park outings.
  • Age above 8: Apologise — services are for children up to 8 years, you are not the right fit.
- After the activities (for ages 8 and below), write [PRICING_IMAGE] on its own line so the pricing image is sent.
- After the image, include the pricing context — use judgment on how much to say based on what they asked:
  • If they asked about full pricing/services: mention the trial session at ₹500/hour.
  • If they just asked to see the pricing table or asked a follow-up: just briefly say "Please refer to the pricing details above."
- End with "Feel free to let us know if you have any questions." as a separate line.
- Do NOT add nanny disclaimer unless the user specifically asked about nanny services.
- Do NOT send [PRICING_IMAGE] unless the conversation is specifically about pricing, services, or packages.

NANNY SERVICES (only when user asks about nanny/caretaker/babysitter):
- Ask child's age, give age-appropriate activities, then write [PRICING_IMAGE], then clarify: we don't provide nanny services — team members are female graduates/students, English interaction.

MONTHLY PACKAGES (only when user asks about packages/monthly plans):
- Write [MONTH_IMAGE] on its own line, then explain the package flexibility (bundle of sessions, discounted rate, can be used over 1–3 months).
- End with "Feel free to let us know if you have any questions."

MEMBER QUALIFICATIONS:
- Motivated, compassionate female graduates/students passionate about teaching. Comprehensive in-house training.

SAME MEMBER EVERY TIME:
- We keep 2–3 members per account for continuity, accounting for short and long leaves.

OTHER BABY WORK (feeding, cleaning, etc.):
- Scope is limited to engaging children through fun and learning. Can encourage snacks if child is not a fussy eater.

TOO EXPENSIVE / OUT OF BUDGET:
- Thank them for considering, invite them to reach out for ad-hoc support.

TIME SLOT REQUEST:
- "Sure, allow me to check the slot availability and come back to you."

NEW SESSION / LOCATION:
- Ask them to share their location to confirm service availability.
---

Goal: Make the user feel like they are chatting with a real human agent and move them towards booking a trial session.` +
      (KIDDOST_WEBSITE_CONTENT ? `\n\n---\nKidDost Knowledge Base (from www.kiddost.com — use this to answer factual questions about services, activities, philosophy, and contact):\n${KIDDOST_WEBSITE_CONTENT}\n---` : "") +
      exampleBlock;

    res.json({
      systemPrompt,
      history,
      userMessage: message,
      exampleChatFile: exampleChat?.file || null,
      websiteContentLength: KIDDOST_WEBSITE_CONTENT.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug endpoint: return recent messages (for troubleshooting frontend visibility)
app.get('/debug-messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, phone, content, media_url, whatsapp_id, status, sender, role, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return res.json({ data, error });
  } catch (e) {
    console.error('/debug-messages error', e?.message || e);
    return res.status(500).json({ error: true });
  }
});

// Proxy image endpoint for non-public media (temporary fallback)
app.get('/proxy-image', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || typeof url !== 'string') return res.status(400).send('missing url');

    // Only allow known media host(s) for safety
    const allowedHosts = ['public-api.bot.space'];
    const parsed = new URL(url);
    if (!allowedHosts.includes(parsed.hostname)) return res.status(403).send('forbidden host');

    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const buf = Buffer.from(resp.data);
    // Honor an explicit type hint (passed when storing proxy URL from webhook)
    const typeHint = req.query.type;
    let contentType = typeHint || resp.headers['content-type'] || 'application/octet-stream';

    // If upstream didn't provide a useful content-type, sniff common types from magic bytes
    if (!typeHint && (!contentType || contentType === 'application/octet-stream')) {
      if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        contentType = 'image/jpeg';
      } else if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        contentType = 'image/png';
      } else if (buf.length >= 4 && buf.slice(0, 4).toString() === '%PDF') {
        contentType = 'application/pdf';
      } else if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        contentType = 'image/gif';
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    // Force inline disposition so browser attempts to render instead of download
    res.setHeader('Content-Disposition', 'inline');
    return res.end(buf);
  } catch (e) {
    console.error('/proxy-image error', e?.response?.status, e?.message || e);
    return res.status(500).send('proxy error');
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});