import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ====== CONFIG ======
const CHANNEL_ID = "69a6fb50136d322a1f67dbd5"; // Your WhatsApp channel ID
const BOTSPACE_API_KEY = process.env.BOTSPACE_API_KEY; // Set in Render env

// ====== HEALTH CHECK (for Render) ======
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// ====== WEBHOOK ======
app.post("/webhook", async (req, res) => {
  try {
    console.log("Full incoming body:");
    console.log(JSON.stringify(req.body, null, 2));

    // Extract message
    const message =
      req.body?.payload?.payload?.text || "";

    const countryCode = req.body?.phone?.countryCode || "";
    const phone = req.body?.phone?.phone || "";

    const from = `${countryCode}${phone}`;

    console.log("Extracted message:", message);
    console.log("From:", from);

    if (!message) {
      return res.sendStatus(200);
    }

    // ===== SIMPLE AI REPLY (Replace later with OpenAI) =====
    const aiReply = "Hello! How can I assist you today?";

    console.log("AI Reply:", aiReply);

    // ===== SEND MESSAGE BACK TO BOTSPACE =====
    await axios.post(
      `https://public-api.bot.space/v1/${CHANNEL_ID}/message/send-session-message?apiKey=${BOTSPACE_API_KEY}`,
      {
        to: from,
        type: "text",
        text: aiReply
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Message sent successfully");

    res.sendStatus(200);

  } catch (error) {
    console.log("=== BOTSPACE ERROR ===");
    console.log(error.response?.data || error.message);
    res.sendStatus(200);
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});