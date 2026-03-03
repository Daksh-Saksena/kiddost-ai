app.post("/webhook", async (req, res) => {
  console.log("Full incoming body:", JSON.stringify(req.body, null, 2));

  const message = req.body?.message?.content;
  const countryCode = req.body?.countryCode;
  const phone = req.body?.phone;

  if (!message) {
    return res.status(200).send("No message content");
  }

  console.log("Extracted message:", message);
  console.log("From:", countryCode + phone);

  res.status(200).send("OK");
});