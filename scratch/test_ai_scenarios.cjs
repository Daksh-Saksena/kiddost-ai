const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// Extract getSystemPrompt function from server.js
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const promptStart = serverCode.indexOf('function getSystemPrompt(');
const promptEnd = serverCode.indexOf('\nfunction hashPin(');
if (promptStart === -1 || promptEnd === -1) {
  console.error("Could not locate getSystemPrompt in server.js");
  process.exit(1);
}
const promptFnCode = serverCode.substring(promptStart, promptEnd);
const KIDDOST_WEBSITE_CONTENT = "";
const getSystemPrompt = new Function('varsBlock = ""', 'sessionStatusBlock = ""', 'exampleBlock = ""', 'KIDDOST_WEBSITE_CONTENT = ""', `
  ${promptFnCode}
  return getSystemPrompt(varsBlock, sessionStatusBlock, exampleBlock);
`);

async function callAI(history, userMessage) {
  const systemPrompt = getSystemPrompt("", "", "", "");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage }
  ];

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages,
          temperature: 0
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      return res.data.choices[0].message.content.trim();
    } catch (err) {
      if (err.response?.status === 429 && attempt < 4) {
        const delay = (attempt + 1) * 2000;
        console.warn(`[429 Rate Limit] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

async function runAll() {
  console.log("=== RUNNING AI SYSTEM PROMPT REGRESSION TESTS ===\n");

  // Test 1: Member qualifications (Must NOT say "Sorry, we don't share member profiles")
  console.log("--- Test 1: Qualifications Inquiry ---");
  const reply1 = await callAI([], "What are your member qualifications?");
  console.log("User: What are your member qualifications?");
  console.log("AI:", reply1);
  const pass1 = /motivated and compassionate female graduates/i.test(reply1) && !/don'?t share.*profile/i.test(reply1);
  console.log("Test 1 Result:", pass1 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 2: Profile sharing request (MUST say "Sorry, we don't share our members profile")
  console.log("--- Test 2: Profile Sharing Request ---");
  const reply2 = await callAI([], "Can I see the teacher's profile and resume before booking?");
  console.log("User: Can I see the teacher's profile and resume before booking?");
  console.log("AI:", reply2);
  const pass2 = /don'?t share our members?['\s]+profiles?/i.test(reply2);
  console.log("Test 2 Result:", pass2 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 3: Hesitation / "I will get back to you"
  console.log("--- Test 3: Hesitation / Get Back To You ---");
  const reply3 = await callAI(
    [
      { role: "user", content: "What are your rates?" },
      { role: "assistant", content: "[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour.\n\nFeel free to let us know if you have any questions." }
    ],
    "Ok thanks I will get back to you"
  );
  console.log("User: Ok thanks I will get back to you");
  console.log("AI:", reply3);
  const pass3 = /Thank you for considering our services! If you ever need ad-hoc support, don’t hesitate to reach out\. We’re here to help\./i.test(reply3);
  console.log("Test 3 Result:", pass3 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 4: Teacher continuity
  console.log("--- Test 4: Teacher Continuity ---");
  const reply4 = await callAI([], "Will I get the same teacher every time or different one?");
  console.log("User: Will I get the same teacher every time or different one?");
  console.log("AI:", reply4);
  const pass4 = /2 to 3 dedicated team members/i.test(reply4) && !/same (?:teacher|member) every time/i.test(reply4);
  console.log("Test 4 Result:", pass4 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 5a: Monthly packages inquiry (Single child — ONLY 1 paragraph)
  console.log("--- Test 5a: Monthly Package Inquiry (1 Child) ---");
  const reply5a = await callAI(
    [
      { role: "user", content: "He is 3 years old" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading etc.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour." }
    ],
    "After the introductory session how can I enquire about monthly package"
  );
  console.log("User: After the introductory session how can I enquire about monthly package");
  console.log("AI:", reply5a);
  const pass5a = /\[MONTH_IMAGE\]/i.test(reply5a) &&
    /packages offer you the flexibility/i.test(reply5a) &&
    !/customize the package/i.test(reply5a) &&
    !/Could I please know the child'?s age/i.test(reply5a);
  console.log("Test 5a Result:", pass5a ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 5b: Monthly packages inquiry (2 Kids / Twins — BOTH paragraphs)
  console.log("--- Test 5b: Monthly Package Inquiry (2 Kids / Twins) ---");
  const reply5b = await callAI(
    [
      { role: "user", content: "I have twins aged 4" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading, worksheets etc.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour." }
    ],
    "For 1 month two kids how much cost for value package?"
  );
  console.log("User: For 1 month two kids how much cost for value package?");
  console.log("AI:", reply5b);
  const pass5b = /\[MONTH_IMAGE\]/i.test(reply5b) &&
    /packages offer you the flexibility/i.test(reply5b) &&
    /customize the package as per your requirement/i.test(reply5b) &&
    !/Could I please know the child'?s age/i.test(reply5b);
  console.log("Test 5b Result:", pass5b ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 6: UNSURE check on out-of-scope query
  console.log("--- Test 6: UNSURE Trigger Check ---");
  const reply6 = await callAI([], "Do you sell laptops or computers?");
  console.log("User: Do you sell laptops or computers?");
  console.log("AI:", reply6);
  const pass6 = /UNSURE/i.test(reply6);
  console.log("Test 6 Result:", pass6 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 7: Pure acknowledgment "Ok." (MUST NOT trigger hesitation ad-hoc message)
  console.log("--- Test 7: Pure Acknowledgment 'Ok.' ---");
  const reply7 = await callAI(
    [
      { role: "user", content: "Once a person comes .. will same person comes every time" },
      { role: "assistant", content: "We assign 2 to 3 dedicated team members per family to ensure continuity for your child while accounting for any short or long leaves.\n\nFeel free to let us know if you have any questions." }
    ],
    "Ok."
  );
  console.log("User: Ok.");
  console.log("AI:", reply7);
  const pass7 = !/Thank you for considering our services/i.test(reply7) && !/ad-hoc support/i.test(reply7);
  console.log("Test 7 Result:", pass7 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 8: Weekend inquiry (MUST state Saturdays open, Sundays closed)
  console.log("--- Test 8: Weekend Inquiry ---");
  const reply8 = await callAI([], "You also come over weekend for introductory session?");
  console.log("User: You also come over weekend for introductory session?");
  console.log("AI:", reply8);
  const pass8 = /closed on sundays/i.test(reply8) && !/Yes,\s*we can schedule.*weekend/i.test(reply8);
  console.log("Test 8 Result:", pass8 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 9: Saturday "Tomorrow" booking request (MUST reject Sunday booking)
  console.log("--- Test 9: Saturday 'Tomorrow' Booking Request ---");
  const reply9 = await callAI(
    [
      { role: "user", content: "You also come over weekend for introductory session?" },
      { role: "assistant", content: "We offer sessions on Saturdays, but we are closed on Sundays." }
    ],
    "How about tomorrow 3 to 4 pm"
  );
  console.log("User: How about tomorrow 3 to 4 pm");
  console.log("AI:", reply9);
  const pass9 = /operational Monday to Saturday/i.test(reply9) && !/may I know your name/i.test(reply9);
  console.log("Test 9 Result:", pass9 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 10: Same member preference statement (Must NOT agree to single person)
  console.log("--- Test 10: Same Member Preference Statement ---");
  const reply10 = await callAI(
    [
      { role: "user", content: "My child is 3 years old" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading etc. We can also help in introducing concepts like phonics, writing etc. Additionally our members can also take them to park for physical activity." }
    ],
    "I am looking for a daily service with the same person"
  );
  console.log("User: I am looking for a daily service with the same person");
  console.log("AI:", reply10);
  const pass10 = /2 to 3 dedicated team members/i.test(reply10) &&
    !/accommodate.*same (?:person|teacher|member)/i.test(reply10) &&
    !/same person for your child/i.test(reply10);
  console.log("Test 10 Result:", pass10 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 11: No proactive booking push
  console.log("--- Test 11: No Proactive Booking Push ---");
  const reply11 = await callAI([], "What activities do you do for a 5 year old?");
  console.log("User: What activities do you do for a 5 year old?");
  console.log("AI:", reply11);
  const pass11 = !/would you like to (?:proceed with booking|schedule a session)/i.test(reply11) &&
    !/shall (?:i|we) book a session/i.test(reply11) &&
    !/what date would you like to start/i.test(reply11);
  console.log("Test 11 Result:", pass11 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 12: ID documents & credentials request in advance (Must reject sharing)
  console.log("--- Test 12: ID Documents & Credentials Sharing Request ---");
  const reply12 = await callAI(
    [],
    "Will it be possible to share the ID documents of the person when they come? Will it be possible to know the credentials of the person in advance?"
  );
  console.log("User: Will it be possible to share the ID documents of the person when they come? Will it be possible to know the credentials of the person in advance?");
  console.log("AI:", reply12);
  const pass12 = /don'?t share our members?['\s]+(?:profiles?|personal ID)/i.test(reply12) &&
    !/can (?:certainly )?provide ID documents/i.test(reply12) &&
    !/provide.*credentials.*in advance/i.test(reply12);
  console.log("Test 12 Result:", pass12 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 13: Location detection overrides booking flow
  console.log("--- Test 13: Location Detection Overrides Booking Flow ---");
  const reply13 = await callAI(
    [
      { role: "user", content: "He is 4 years old" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading, worksheets etc. We can also help in studies if required. Additionally our members can also take them to park for physical activity." }
    ],
    "When can I get a test session? My location is Sompura Gate, Sarjapura Road"
  );
  console.log("User: When can I get a test session? My location is Sompura Gate, Sarjapura Road");
  console.log("AI:", reply13);
  const pass13 = /Let me check if we can service your area/i.test(reply13) &&
    !/What time slot would work best/i.test(reply13);
  console.log("Test 13 Result:", pass13 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 14: Schedule delay ("I need to check") vs false refusal
  console.log("--- Test 14: Schedule Delay ('I need to check') ---");
  const reply14 = await callAI(
    [
      { role: "user", content: "Can I book an intro session for my 4 year old?" },
      { role: "assistant", content: "What date and time would work best for you?" }
    ],
    "I need to check"
  );
  console.log("User: I need to check");
  console.log("AI:", reply14);
  const pass14 = /take your time/i.test(reply14) &&
    !/Allow me to check the slot availability/i.test(reply14) &&
    !/UNSURE/i.test(reply14);
  console.log("Test 14 Result:", pass14 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 15: Job applicant follow-up (Must NOT send ad-hoc exit, must ask for resume)
  console.log("--- Test 15: Job Applicant Follow-up ---");
  const reply15 = await callAI(
    [
      { role: "user", content: "Any vacancies, hiring?" },
      { role: "assistant", content: "Could you please tell your location in Bangalore and share your resume? We will get back to you." },
      { role: "user", content: "Malleshwaram" },
      { role: "assistant", content: "Thank you for sharing your location! Please share your resume, and we will get back to you." }
    ],
    "Maam im looking for job if you have any vacancy let me know\nOkay"
  );
  console.log("User: Maam im looking for job if you have any vacancy let me know\\nOkay");
  console.log("AI:", reply15);
  const pass15 = /share your resume/i.test(reply15) &&
    !/considering our services/i.test(reply15) &&
    !/ad-hoc support/i.test(reply15);
  console.log("Test 15 Result:", pass15 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 16: 2nd Price complaint after value packages (Must send competitive pricing, NOT exit)
  console.log("--- Test 16: 2nd Price Complaint After Value Packages ---");
  const reply16 = await callAI(
    [
      { role: "user", content: "She is 3 yrs old" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading etc. We can also help in introducing concepts like phonics, writing etc. Additionally our members can also take them to park for physical activity.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour." },
      { role: "user", content: "500rs per hour for this age looks expensive" },
      { role: "assistant", content: "We also offer value packages which give you a bundle of sessions at a discounted rate!\n\n[MONTH_IMAGE]\nOur KidDost packages offer you the flexibility to purchase a bundle of sessions at a discounted rate, allowing you to use them according to your specific needs. The choice is yours; you can use them within a month or extend their use over 2-3 months.\n\nFeel free to let us know if you have any questions." }
    ],
    "Thank you this is expensive"
  );
  console.log("User: Thank you this is expensive");
  console.log("AI:", reply16);
  const pass16 = /most competitive pricing/i.test(reply16) &&
    !/ad-hoc support/i.test(reply16);
  console.log("Test 16 Result:", pass16 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 17: User opening message mentioning age (Must NOT ask for child's age)
  console.log("--- Test 17: Opening Message Mentioning Age ---");
  const reply17 = await callAI(
    [],
    "Cost for teaching craft for 3 yr old\nOr painting"
  );
  console.log("User: Cost for teaching craft for 3 yr old\\nOr painting");
  console.log("AI:", reply17);
  const pass17 = /puzzles|memory games|art and craft/i.test(reply17) &&
    !/Could I please know the child'?s age/i.test(reply17) &&
    !/share your child'?s age/i.test(reply17);
  console.log("Test 17 Result:", pass17 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 18: Nanny inquiry with age in same message (Must give activities + pricing + nanny disclaimer, must NOT ask for age)
  console.log("--- Test 18: Nanny Inquiry With Age In Message ---");
  const reply18 = await callAI(
    [],
    "Need a Nanny for a 2.5 year old"
  );
  console.log("User: Need a Nanny for a 2.5 year old");
  console.log("AI:", reply18);
  const pass18 = /verbal interaction|age appropriate puzzles|toys|rhymes/i.test(reply18) &&
    /don'?t provide nanny services/i.test(reply18) &&
    !/Could I please know the child'?s age/i.test(reply18);
  console.log("Test 18 Result:", pass18 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 19: Nanny disclaimer on subsequent age message (Must give activities + pricing + nanny disclaimer)
  console.log("--- Test 19: Nanny Disclaimer On Subsequent Age Reply ---");
  const reply19 = await callAI(
    [
      { role: "user", content: "Need a nanny" },
      { role: "assistant", content: "Could I please know the child's age first?" }
    ],
    "2.5"
  );
  console.log("User: 2.5");
  console.log("AI:", reply19);
  const pass19 = /verbal interaction|age appropriate puzzles/i.test(reply19) &&
    /don'?t provide nanny services/i.test(reply19);
  console.log("Test 19 Result:", pass19 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 20: Booking request without location (Must ask for locality, must NOT say 'check if we can service your area')
  console.log("--- Test 20: Booking Request Without Location ---");
  const reply20 = await callAI(
    [
      { role: "user", content: "Need service for a 3 year old" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading etc. We can also help in introducing concepts like phonics, writing etc. Additionally our members can also take them to park for physical activity.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour.\n\nFeel free to let us know if you have any questions." }
    ],
    "Can you send tomorrow at 5PM\nFor 1 hr"
  );
  console.log("User: Can you send tomorrow at 5PM\\nFor 1 hr");
  console.log("AI:", reply20);
  const pass20 = !/service your area/i.test(reply20) &&
    /(?:share your (?:name and )?(?:area|locality)|area or locality|where (?:do you live|are you located))/i.test(reply20);
  console.log("Test 20 Result:", pass20 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 21: Out-of-scope personal advice / crush (Must reply UNSURE, NOT entertain)
  console.log("--- Test 21: Out-of-Scope Personal Advice (Crush) ---");
  const reply21 = await callAI(
    [],
    "I am crushing on girl  how can I impress she"
  );
  console.log("User: I am crushing on girl  how can I impress she");
  console.log("AI:", reply21);
  const pass21 = /^UNSURE$/i.test(reply21.trim());
  console.log("Test 21 Result:", pass21 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 22: Out-of-scope gift advice (Must reply UNSURE, NOT entertain)
  console.log("--- Test 22: Out-of-Scope Gift Advice ---");
  const reply22 = await callAI(
    [],
    "What type to give me gift to she"
  );
  console.log("User: What type to give me gift to she");
  console.log("AI:", reply22);
  const pass22 = /^UNSURE$/i.test(reply22.trim());
  console.log("Test 22 Result:", pass22 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 23: Detailed opening inquiry starting with 'Hi' (Must NOT send bare 'Hello! How can I help you today?')
  console.log("--- Test 23: Detailed Inquiry Starting With 'Hi' ---");
  const reply23 = await callAI(
    [],
    "Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)"
  );
  console.log("User: Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)");
  console.log("AI:", reply23);
  const pass23 = !/^Hello!\s+How can I help you today\??$/i.test(reply23.trim()) &&
    /(?:child'?s age|share your child'?s age|how old is your child)/i.test(reply23);
  console.log("Test 23 Result:", pass23 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 24: Single child duration inquiry (Must NOT ask "Would you like both children in the same session...")
  console.log("--- Test 24: Single Child Duration Inquiry ---");
  const reply24 = await callAI(
    [
      { role: "user", content: "Hi, I am interested in hiring a supervisor to engage with my child (play games, puzzles etc)" },
      { role: "assistant", content: "Could I please know the child's age first?" },
      { role: "user", content: "6 years" },
      { role: "assistant", content: "For this age category we engage the child with puzzles, memory games, art and craft, brain boosting activities, storybook reading, worksheets etc. We can also help in studies if required. Additionally our members can also take them to park for physical activity.\n\n[PRICING_IMAGE]\nWe suggest scheduling a one-hour introductory session at your convenience. For the first experience of our service, we are happy to offer it at a discounted price of ₹500 per hour.\n\nFeel free to let us know if you have any questions." }
    ],
    "I need the engagement for 4 hours in the evening"
  );
  console.log("User: I need the engagement for 4 hours in the evening");
  console.log("AI:", reply24);
  const pass24 = !/both children|separate sessions for each child/i.test(reply24);
  console.log("Test 24 Result:", pass24 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 25: Inquiry with typo/informal 'Hi, could iHi know more?' (Must ask for child's age, must NOT reply UNSURE or bare greeting)
  console.log("--- Test 25: Inquiry 'Hi, could iHi know more?' ---");
  const reply25 = await callAI(
    [],
    "Hi, could iHi know more?"
  );
  console.log("User: Hi, could iHi know more?");
  console.log("AI:", reply25);
  const pass25 = !/^UNSURE$/i.test(reply25.trim()) &&
    !/^Hello!\s+How can I help you today\??$/i.test(reply25.trim()) &&
    /(?:child'?s age|share your child'?s age|how old is your child)/i.test(reply25);
  console.log("Test 25 Result:", pass25 ? "PASS ✅" : "FAIL ❌");
  console.log();

  // Test 26: General inquiry 'Could I know more?' (Must ask for child's age, must NOT reply UNSURE)
  console.log("--- Test 26: General Inquiry 'Could I know more?' ---");
  const reply26 = await callAI(
    [],
    "Could I know more?"
  );
  console.log("User: Could I know more?");
  console.log("AI:", reply26);
  const pass26 = !/^UNSURE$/i.test(reply26.trim()) &&
    !/^Hello!\s+How can I help you today\??$/i.test(reply26.trim()) &&
    /(?:child'?s age|share your child'?s age|how old is your child)/i.test(reply26);
  console.log("Test 26 Result:", pass26 ? "PASS ✅" : "FAIL ❌");
  console.log();

  const allPassed = pass1 && pass2 && pass3 && pass4 && pass5a && pass5b && pass6 && pass7 && pass8 && pass9 && pass10 && pass11 && pass12 && pass13 && pass14 && pass15 && pass16 && pass17 && pass18 && pass19 && pass20 && pass21 && pass22 && pass23 && pass24 && pass25 && pass26;
  console.log("OVERALL RESULT:", allPassed ? "ALL 26 TESTS PASSED ✅" : "SOME TESTS FAILED ❌");
}

runAll().catch(console.error);
