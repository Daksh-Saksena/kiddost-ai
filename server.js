import express from "express";

const app = express();
app.use(express.json());

/* Health Check Route */
app.get("/", (req, res) => {
  res.send("Server is running");
});

/* BotSpace Webhook */
app.post("/webhook", async (req, res) => {
  try {
    console.log("==== NEW WEBHOOK HIT ====");
    console.log("Full incoming body:");
    console.log(JSON.stringify(req.body, null, 2));

    // Extract message text
    const message = req.body?.payload?.payload?.text;

    // Extract phone number
    const countryCode = req.body?.phone?.countryCode;
    const phone = req.body?.phone?.phone;

    const fullNumber =
      countryCode && phone ? `${countryCode}${phone}` : null;

    console.log("Extracted message:", message);
    console.log("From:", fullNumber);

    if (!message) {
      console.log("No message text found.");
      return res.status(200).send("OK");
    }

    // For now just confirm receipt
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Server error");
  }
});

/* Start Server */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});