const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// আপনার গোপন তথ্যগুলো এখানে বসান
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; 
const PAGE_ACCESS_TOKEN = "EAAWE8yA3hsIBQW48mMIHgJn14z2iThsZBa8EjOuomoBQOeZCyrINWDcJVlT4b1pwZAJLbkZAaKBVcJFCY8A5j23qJlQHiPmmlSImUqkEZA1umMFfjUSfF9ZCscIgReg9bJ7iBT0eTHk46xAOO8W5isjHClA5YMrYNASMV2Vqv0GXHV5kCjZC4nzQuHfWZBmmHx4LuQdr4AZDZD"; 
const GEMINI_API_KEY = "AIzaSyDGF8uh5wCMPv9Ex3Y67iD-HpixbsQq3Zo"; 

// আপনার লিস্ট থেকে পাওয়া লেটেস্ট মডেল
const MODEL_NAME = "gemini-2.0-flash"; 
// ==========================================

const SYSTEM_PROMPT = "তুমি ইকোনমিস্ট বট। বাংলায় ছোট করে উত্তর দাও।";

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send(`Bot Running with ${MODEL_NAME}`);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// মেসেজ হ্যান্ডলিং (Vercel ফিক্স: আগে কাজ, পরে রেসপন্স)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    try {
      // লুপ চালিয়ে মেসেজ বের করা
      for (const entry of body.entry) {
        const webhook_event = entry.messaging ? entry.messaging[0] : null;

        if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
          const sender_psid = webhook_event.sender.id;
          const userMessage = webhook_event.message.text;

          console.log(`User says: ${userMessage}`);

          // আমরা এখানে await করছি যাতে কাজ শেষ না হওয়া পর্যন্ত সার্ভার বন্ধ না হয়
          await handleFullConversation(sender_psid, userMessage);
        }
      }
      
      // সব কাজ শেষ, এখন ফেসবুককে বিদায় জানানো
      res.status(200).send("EVENT_RECEIVED");

    } catch (error) {
      console.error("Critical Error:", error.message);
      res.status(500).send("Server Error");
    }
  } else {
    res.sendStatus(404);
  }
});

// পুরো কথোপকথন হ্যান্ডেল করার ফাংশন
async function handleFullConversation(sender_psid, userMessage) {
  try {
    // ১. টাইপিং অন
    await sendAction(sender_psid, "typing_on");

    // ২. Gemini কল (সরাসরি লিঙ্ক)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\nUser: ${userMessage}\nAssistant:` }] }]
    };

    console.log("Calling Gemini...");
    const response = await axios.post(geminiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // উত্তর সাজানো
    let botReply = "দুঃখিত, উত্তর তৈরি করা যায়নি।";
    if (response.data.candidates && response.data.candidates.length > 0) {
      botReply = response.data.candidates[0].content.parts[0].text;
    }
    console.log("Gemini Replied:", botReply);

    // ৩. টাইপিং অফ
    await sendAction(sender_psid, "typing_off");

    // ৪. মেসেজ পাঠানো
    await sendMessage(sender_psid, { text: botReply });

  } catch (error) {
    console.error("Process Failed:", error.message);
    // Gemini ফেল করলে ইউজারকে জানানো
    if(error.response) {
        console.error("Gemini Error Detail:", JSON.stringify(error.response.data));
    }
    await sendMessage(sender_psid, { text: "সার্ভারে সমস্যা হচ্ছে, পরে চেষ্টা করুন।" });
  }
}

// ফেসবুক সেন্ড ফাংশন
async function sendMessage(id, msg) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id }, message: msg }
    );
    console.log("Message Sent to Facebook!");
  } catch (error) {
    console.error("FB Send Error:", error.response ? error.response.data : error.message);
  }
}

// টাইপিং অ্যাকশন
async function sendAction(id, action) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id }, sender_action: action }
    );
  } catch (e) { /* Ignore */ }
}

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
