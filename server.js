import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/webhook", async (req, res) => {
  console.log("Full incoming body:");
  console.log(JSON.stringify(req.body, null, 2));

  const message = req.body?.message?.content;
  const countryCode = req.body?.countryCode;
  const phone = req.body?.phone;

  console.log("Extracted message:", message);
  console.log("From:", countryCode + phone);

  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});