const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// আপনার গোপন তথ্যগুলো এখানে বসান
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; 
const PAGE_ACCESS_TOKEN = "EAAWE8yA3hsIBQeyMnQCZBE5iJAYyZCqjJiL1AYvsIjwBFCWmn6hz1uH897q9fZCuAF5ZCZC2GyMhJW6UJNZCvWnOJa8bwRbejN8sCI6ZC4TwpuqZBGLSVvC2SWVAOMFdifVN60Eq4ilE1DkGrjIPOLDAJ1usCyPhdwvbUUmcHWnLx4FRXRZBJSErYDRhCHM1jNzwh1vjfNQZDZD"; 
const GEMINI_API_KEY = "AIzaSyDGF8uh5wCMPv9Ex3Y67iD-HpixbsQq3Zo"; 

// Gemini সেটআপ
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// বট-এর চরিত্র (System Prompt)
const SYSTEM_INSTRUCTION = `
তুমি হলে মঞ্জুরুল হকের পার্সোনাল অ্যাসিস্ট্যান্ট। 
তোমার নাম ইকোনমিস্ট বট।
তুমি সবার সাথে খুব বিনয়ের সাথে বাংলায় কথা বলবে।
উত্তরগুলো খুব ছোট এবং সহজ ভাষায় দেবে (মেসেঞ্জারের জন্য উপযোগী)।
`;

app.use(bodyParser.json());

// রুট চেক
app.get("/", (req, res) => {
  res.send("Gemini Chatbot Server is Running!");
});

// ফেসবুক ভেরিফিকেশন
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// মেসেজ রিসিভ করা
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    // ফেসবুককে সাথে সাথে জানিয়ে দেওয়া (Timeout ঠেকানোর জন্য)
    res.status(200).send("EVENT_RECEIVED");

    body.entry.forEach((entry) => {
      const webhook_event = entry.messaging ? entry.messaging[0] : null;

      if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
        const sender_psid = webhook_event.sender.id;
        const userMessage = webhook_event.message.text;

        console.log(`User says: ${userMessage}`);

        // Gemini এর কাছে পাঠানো
        handleGeminiResponse(sender_psid, userMessage);
      }
    });
  } else {
    res.sendStatus(404);
  }
});

// Gemini এবং রিপ্লাই হ্যান্ডলার
async function handleGeminiResponse(sender_psid, userMessage) {
  try {
    // ১. টাইপিং ইন্ডিকেটর দেখানো
    await sendTypingAction(sender_psid, "typing_on");

    // ২. Gemini মডেল কল করা
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ফাস্ট এবং স্মার্ট মডেল

    // ৩. প্রম্পট তৈরি করা (সিস্টেম ইন্সট্রাকশন সহ)
    const prompt = `${SYSTEM_INSTRUCTION}\n\nUser asked: ${userMessage}\nAnswer:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botReply = response.text();

    console.log(`Gemini Replied: ${botReply}`);

    // ৪. টাইপিং বন্ধ করা
    await sendTypingAction(sender_psid, "typing_off");

    // ৫. মেসেজ পাঠানো
    await callSendAPI(sender_psid, { text: botReply });

  } catch (error) {
    console.error("Error from Gemini or Facebook:", error.message);
    await callSendAPI(sender_psid, { text: "দুঃখিত, একটু সমস্যা হচ্ছে। পরে আবার চেষ্টা করুন।" });
  }
}

// ফেসবুক সেন্ড ফাংশন
async function callSendAPI(sender_psid, response) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: sender_psid },
        message: response
      }
    );
  } catch (error) {
    console.error("Failed to send message:", error.response ? error.response.data : error.message);
  }
}

// টাইপিং অ্যাকশন ফাংশন
async function sendTypingAction(sender_psid, action) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: sender_psid },
        sender_action: action
      }
    );
  } catch (error) {
    // ইগনোর করা যেতে পারে
  }
}

app.listen(PORT, () => {
  console.log(`Gemini Bot listening on port ${PORT}`);
});
