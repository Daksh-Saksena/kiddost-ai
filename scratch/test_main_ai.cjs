const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const serverCode = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const promptStart = serverCode.indexOf("function getSystemPrompt(");
const promptEnd = serverCode.indexOf("\nfunction hashPin(");
const promptFnCode = serverCode.substring(promptStart, promptEnd);
const getSystemPrompt = new Function("varsBlock = \"\"", "sessionStatusBlock = \"\"", "exampleBlock = \"\"", "KIDDOST_WEBSITE_CONTENT = \"\"", `
  ${promptFnCode}
  return getSystemPrompt(varsBlock, sessionStatusBlock, exampleBlock);
`);

const history = [
  { role: "user", content: "Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)" },
  { role: "assistant", content: "Hello! How can I help you today?" },
  { role: "user", content: "Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)" },
  { role: "assistant", content: "Could I please know the child's age first?" },
  { role: "user", content: "6 years" },
  { role: "assistant", content: "For your 6-year-old, we engage children with puzzles, memory games, art and craft, brain-boosting activities, storybook reading, worksheets, etc. We can also help in studies if required. Additionally, our members can take them to the park for physical activity.\n\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour.\n\nFeel free to let us know if you have any questions." }
];

const combinedMessage = "I need the engagement for 4 hours in the evening";

async function testMainAI() {
  const varsBlock = "\n\nKNOWN FACTS about this family:\n- Unnamed child: 6 years old";
  const systemPrompt = getSystemPrompt(varsBlock, "", "");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: combinedMessage }
  ];

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages,
      temperature: 0
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  console.log("Raw AI response:\n", res.data.choices[0].message.content);
}
testMainAI();
