const fs = require("fs");
const path = require("path");

const serverCode = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

// Extract EXAMPLE_CHATS and findBestExampleChat
const exStart = serverCode.indexOf("const EXAMPLE_CHATS =");
const fnStart = serverCode.indexOf("function findBestExampleChat(");
const fnEnd = serverCode.indexOf("\nfunction extractProgramDescription(");

const code = serverCode.substring(exStart, fnEnd);
eval(code);

const best = findBestExampleChat("engagement activities for 6 years");
console.log("Best chat match for query 1:", best?.id, best?.user_query);
const best2 = findBestExampleChat("I need the engagement for 4 hours in the evening");
console.log("Best chat match for query 2:", best2?.id, best2?.user_query);

if (best) {
  console.log("Messages in best:", JSON.stringify(best.msgs, null, 2));
}
