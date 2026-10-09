const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const history = [
  { role: "user", content: "Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)" },
  { role: "assistant", content: "Could I please know the child's age first?" },
  { role: "user", content: "6 years" },
  { role: "assistant", content: "For your 6-year-old, we engage children with puzzles, memory games, art and craft, brain-boosting activities, storybook reading, worksheets, etc.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour." }
];

const combinedMessage = "I need the engagement for 4 hours in the evening";

async function testIntent() {
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
- "isOutOfScope": true if the user's message is asking about personal advice (such as crushes, dating, romance, how to impress someone, best friends, gift ideas), homework, trivia, jokes, storytelling, general AI conversation, or ANY topic completely unrelated to KidDost child engagement, babysitting, tutoring, or service booking in Bangalore
- "children": array of children mentioned ANYWHERE in the FULL conversation. Each entry: { "name": string or null, "age": string or number or null }. CRITICAL: If the child's age is in months (e.g. "10 months", "4 months", "18 months"), keep it as a string with "months" (e.g. "10 months"). Example: [{"name":"Ram","age":4},{"name":null,"age":"10 months"}]
- "notes": an object of important facts/details about the customer mentioned ANYWHERE in the conversation. Extract things like:
  • "parentName": mother's/father's name if mentioned
  • "spouseName": husband/wife name if mentioned
  • "location": area, locality, address if mentioned (extract the PLACE NAME, not a URL — if user only shares a link, skip this field)
  • "school": child's school if mentioned
  • "preferences": any specific preferences for sessions (e.g. "only weekends", "no art")
  • "allergies": any allergies or health concerns
  • "referral": how they heard about us
  • Any other notable facts — use descriptive keys in camelCase
  Only include fields that are actually mentioned. Do NOT guess or infer.
- "searchQuery": a short keyword phrase (3-6 words) to search for relevant past conversations. If asking about activities, include the child's age.
Consider the FULL conversation history carefully — do not confuse one child's age with another's.`
        },
        ...history,
        { role: "user", content: combinedMessage }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" } }
  );
  console.log("Intent result:", intentRes.data.choices[0].message.content);
}
testIntent();
