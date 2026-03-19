import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import crypto from "crypto";
import webpush from "web-push";
dotenv.config();

const app = express();
app.use(express.json({ limit: '95mb' }));
// Restrict CORS to the Vercel frontend origin
app.use(cors({
  origin: "https://kiddost-ai.vercel.app",
  methods: ["GET", "POST"],
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

    // Ensure the AI sees the combined version of the recent user input
    const messagesForAI = [
      {
        role: "system",
        content:
          "You are a friendly WhatsApp assistant for Kiddost. Help parents understand programs, classes, and enrollment."
      },
      ...history,
      { role: "user", content: combinedMessage }
    ];

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: messagesForAI
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

    // Save AI reply (AI agent = null, ai_enabled = true)
    await supabase.from("messages").insert({
      phone: fullPhone,
      role: "assistant",
      content: aiReply,
      sender: "ai",
      agent: null,
      ai_enabled: true
    });

    // Send message back via BotSpace
    await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message`,
      {
        name: "User",
        phone: fullPhone,
        text: aiReply
      },
      {
        params: {
          apiKey: BOTSPACE_API_KEY
        },
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

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

// Health check
app.get("/", (req, res) => {
  res.send("Kiddost AI running 🚀");
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
  const { phone, label } = req.body;
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

    if (!existingConversation) {
      await supabase.from("conversations").insert({
        phone: fullPhone,
        conversation_id: botspaceConversationId
      });
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

    // Only buffer text messages for AI (ignore pure media for AI)
    if (message) {
      if (!messageBuffers[fullPhone]) messageBuffers[fullPhone] = [];
      messageBuffers[fullPhone].push(message);

      // clear previous timer if any
      if (messageTimers[fullPhone]) {
        clearTimeout(messageTimers[fullPhone]);
      }

      // wait 10 seconds (user requested 10s buffer) before sending combined text to AI
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
      }, 10000);
    }

    // respond quickly to webhook sender
    return res.status(200).json({ success: true, buffered: !!message });

  } catch (error) {
    console.log("=== ERROR ===");
    console.log(error.response?.data || error.message);
    res.status(200).json({ error: true });
  }
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