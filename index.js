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

// আপনার লিস্ট অনুযায়ী সঠিক মডেলের নাম
const MODEL_NAME = "gemini-2.0-flash"; 
// ==========================================

const SYSTEM_PROMPT = `
তুমি হলে ইকোনমিস্ট বট। তুমি খুব বিনয়ী এবং বাংলায় কথা বলো। 
উত্তর খুব ছোট (৩০ শব্দের মধ্যে) দেবে।
`;

app.use(bodyParser.json());

// রুট চেক
app.get("/", (req, res) => {
  res.send(`Bot is running with model: ${MODEL_NAME}`);
});

// ভেরিফিকেশন
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
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    // ফেসবুককে সাথে সাথে রেসপন্স পাঠানো
    res.status(200).send("EVENT_RECEIVED");

    try {
      for (const entry of body.entry) {
        const webhook_event = entry.messaging ? entry.messaging[0] : null;

        if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
          const sender_psid = webhook_event.sender.id;
          const userMessage = webhook_event.message.text;

          console.log(`User says: ${userMessage}`);
          
          // API কল করা
          await handleGeminiDirect(sender_psid, userMessage);
        }
      }
    } catch (error) {
      console.error("Loop Error:", error.message);
    }
  } else {
    res.sendStatus(404);
  }
});

// সরাসরি API কল (Gemini 2.0 Flash)
async function handleGeminiDirect(sender_psid, userMessage) {
  try {
    await sendTyping(sender_psid, "typing_on");

    // URL কনস্ট্রাকশন (v1beta ব্যবহার করছি কারণ মডেলটি নতুন)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [{ 
          text: `${SYSTEM_PROMPT}\nUser: ${userMessage}\nAssistant:` 
        }]
      }]
    };

    const response = await axios.post(geminiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    // উত্তর বের করা
    let botReply = "দুঃখিত, উত্তর পাওয়া যায়নি।";
    if(response.data.candidates && response.data.candidates.length > 0){
        botReply = response.data.candidates[0].content.parts[0].text;
    }
    
    console.log("Gemini Replied:", botReply);

    await sendTyping(sender_psid, "typing_off");
    await sendMessage(sender_psid, { text: botReply });

  } catch (error) {
    console.error("Gemini API Error:", error.response ? JSON.stringify(error.response.data) : error.message);
    
    await sendMessage(sender_psid, { text: "সার্ভারে একটু সমস্যা হচ্ছে, পরে চেষ্টা করুন।" });
  }
}

async function sendMessage(sender_psid, response) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: sender_psid }, message: response }
    );
  } catch (error) {
    console.error("FB Send Error:", error.message);
  }
}

async function sendTyping(sender_psid, action) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: sender_psid }, sender_action: action }
    );
  } catch (error) {
    // Ignore
  }
}

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
