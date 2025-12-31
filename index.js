const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// আপনার গোপন তথ্য
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; 
const PAGE_ACCESS_TOKEN = "EAAWE8yA3hsIBQW48mMIHgJn14z2iThsZBa8EjOuomoBQOeZCyrINWDcJVlT4b1pwZAJLbkZAaKBVcJFCY8A5j23qJlQHiPmmlSImUqkEZA1umMFfjUSfF9ZCscIgReg9bJ7iBT0eTHk46xAOO8W5isjHClA5YMrYNASMV2Vqv0GXHV5kCjZC4nzQuHfWZBmmHx4LuQdr4AZDZD"; 
const GEMINI_API_KEY = "AIzaSyBjnbUUh_IPOUl9r5tlCgJHsEyrqw62kKM"; 

// [সমাধান] আমরা এখন সবচেয়ে নিরাপদ এবং ফ্রি মডেল ব্যবহার করছি
const MODEL_NAME = "gemini-1.5-flash"; 
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

// মেসেজ হ্যান্ডলিং
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

          // অপেক্ষা করা (await)
          await handleFullConversation(sender_psid, userMessage);
        }
      }
      
      // সব শেষে রেসপন্স
      res.status(200).send("EVENT_RECEIVED");

    } catch (error) {
      console.error("Critical Error:", error.message);
      res.status(500).send("Server Error");
    }
  } else {
    res.sendStatus(404);
  }
});

async function handleFullConversation(sender_psid, userMessage) {
  try {
    await sendAction(sender_psid, "typing_on");

    // Gemini কল (v1beta ব্যবহার করা হচ্ছে)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\nUser: ${userMessage}\nAssistant:` }] }]
    };

    const response = await axios.post(geminiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    let botReply = "দুঃখিত, উত্তর তৈরি করা যায়নি।";
    if (response.data.candidates && response.data.candidates.length > 0) {
      botReply = response.data.candidates[0].content.parts[0].text;
    }
    console.log("Gemini Replied:", botReply);

    await sendAction(sender_psid, "typing_off");
    await sendMessage(sender_psid, { text: botReply });

  } catch (error) {
    // এরর ডিটেইলস
    console.error("Process Failed:", error.message);
    if(error.response) {
        console.error("Gemini Error Detail:", JSON.stringify(error.response.data));
    }
    await sendMessage(sender_psid, { text: "সার্ভারে একটু সমস্যা হচ্ছে, পরে চেষ্টা করুন।" });
  }
}

async function sendMessage(id, msg) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id }, message: msg }
    );
  } catch (error) {
    console.error("FB Send Error:", error.message);
  }
}

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
