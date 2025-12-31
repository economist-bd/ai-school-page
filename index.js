const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// আপনার গোপন তথ্যগুলো এখানে বসান
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; // আপনার আগের ভেরিফাই টোকেন
const PAGE_ACCESS_TOKEN = "EAAWE8yA3hsIBQeyMnQCZBE5iJAYyZCqjJiL1AYvsIjwBFCWmn6hz1uH897q9fZCuAF5ZCZC2GyMhJW6UJNZCvWnOJa8bwRbejN8sCI6ZC4TwpuqZBGLSVvC2SWVAOMFdifVN60Eq4ilE1DkGrjIPOLDAJ1usCyPhdwvbUUmcHWnLx4FRXRZBJSErYDRhCHM1jNzwh1vjfNQZDZD"; // ধাপ ১-এ পাওয়া লম্বা টোকেন
const OPENAI_API_KEY = "AIzaSyDGF8uh5wCMPv9Ex3Y67iD-HpixbsQq3Zo"; // ধাপ ১-এ পাওয়া OpenAI Key

// ==========================================
// বট-এর চরিত্র (System Prompt)
// ==========================================
const BOT_PERSONALITY = `
তুমি হলে মঞ্জুরুল হকের পার্সোনাল অ্যাসিস্ট্যান্ট। 
মঞ্জুরুল হক একজন অর্থনীতির প্রভাষক, গ্রাফিক্স ডিজাইনার এবং ওয়েব ডেভেলপার। 
তার একটি ইউটিউব চ্যানেল আছে যার নাম "Economist"।
তুমি সবার সাথে খুব বিনয়ের সাথে বাংলায় কথা বলবে। কেউ কোর্সের কথা জানতে চাইলে বলবে বিস্তারিত শীঘ্রই জানানো হবে।
খুব ছোট এবং সুন্দর করে উত্তর দেবে।
`;

app.use(bodyParser.json());

// রুট চেক
app.get("/", (req, res) => {
  res.send("AI Chatbot Server is Running!");
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
    // ফেসবুককে সাথে সাথে জানিয়ে দিই যে আমরা মেসেজ পেয়েছি (Timeout ঠেকানোর জন্য)
    res.status(200).send("EVENT_RECEIVED");

    body.entry.forEach((entry) => {
      const webhook_event = entry.messaging ? entry.messaging[0] : null;

      if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
        const sender_psid = webhook_event.sender.id;
        const userMessage = webhook_event.message.text;

        console.log(`User says: ${userMessage}`);

        // AI এর কাছে পাঠানো এবং রিপ্লাই দেওয়া
        handleAIResponse(sender_psid, userMessage);
      }
    });
  } else {
    res.sendStatus(404);
  }
});

// AI এবং রিপ্লাই হ্যান্ডলার
async function handleAIResponse(sender_psid, userMessage) {
  try {
    // ১. টাইপিং ইন্ডিকেটর দেখানো (মানে বট লিখছে...)
    await sendTypingAction(sender_psid, "typing_on");

    // ২. OpenAI (ChatGPT) কে প্রশ্ন পাঠানো
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo", // অথবা "gpt-4o-mini" (কম খরচে ভালো)
        messages: [
          { role: "system", content: BOT_PERSONALITY }, // বটের চরিত্র
          { role: "user", content: userMessage } // ইউজারের প্রশ্ন
        ],
        max_tokens: 150 // উত্তরের দৈর্ঘ্য লিমিট
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const botReply = aiResponse.data.choices[0].message.content;

    // ৩. টাইপিং বন্ধ করা
    await sendTypingAction(sender_psid, "typing_off");

    // ৪. মেসেজ পাঠানো
    await callSendAPI(sender_psid, { text: botReply });

  } catch (error) {
    console.error("Error from OpenAI or Facebook:", error.message);
    // এরর হলে একটি সাধারণ মেসেজ পাঠানো
    await callSendAPI(sender_psid, { text: "দুঃখিত, আমি এখন একটু ব্যস্ত। পরে আবার চেষ্টা করুন।" });
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
    console.error("Failed to send message:", error.message);
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
    // টাইপিং এরর ইগনোর করা যেতে পারে
  }
}

app.listen(PORT, () => {
  console.log(`AI Bot listening on port ${PORT}`);
});
