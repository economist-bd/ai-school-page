const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// আপনার গোপন তথ্যগুলো এখানে বসান (সতর্কতার সাথে)
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; 
const PAGE_ACCESS_TOKEN = "EAAWE8yA3hsIBQW48mMIHgJn14z2iThsZBa8EjOuomoBQOeZCyrINWDcJVlT4b1pwZAJLbkZAaKBVcJFCY8A5j23qJlQHiPmmlSImUqkEZA1umMFfjUSfF9ZCscIgReg9bJ7iBT0eTHk46xAOO8W5isjHClA5YMrYNASMV2Vqv0GXHV5kCjZC4nzQuHfWZBmmHx4LuQdr4AZDZD"; 
const GEMINI_API_KEY = "AIzaSyDGF8uh5wCMPv9Ex3Y67iD-HpixbsQq3Zo"; 

// Gemini সেটআপ
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
তুমি হলে মঞ্জুরুল হকের পার্সোনাল অ্যাসিস্ট্যান্ট। 
তোমার নাম ইকোনমিস্ট বট।
তুমি সবার সাথে খুব বিনয়ের সাথে বাংলায় কথা বলবে।
উত্তরগুলো খুব ছোট এবং সহজ ভাষায় দেবে।
`;

app.use(bodyParser.json());

// রুট চেক
app.get("/", (req, res) => {
  res.send("Gemini Chatbot V2 is Running!");
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

// মেসেজ হ্যান্ডলিং (Vercel ফিক্সড ভার্সন)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    try {
      // লুপ চালিয়ে সব মেসেজ প্রসেস করা (অ্যাসিঙ্ক্রোনাস)
      for (const entry of body.entry) {
        const webhook_event = entry.messaging ? entry.messaging[0] : null;

        if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
          const sender_psid = webhook_event.sender.id;
          const userMessage = webhook_event.message.text;

          console.log(`User says: ${userMessage}`);

          // Gemini-র উত্তরের জন্য অপেক্ষা করা (await)
          await handleGeminiResponse(sender_psid, userMessage);
        }
      }
      
      // সব কাজ শেষ হলে তারপর ফেসবুককে রেসপন্স পাঠানো
      res.status(200).send("EVENT_RECEIVED");
      
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.sendStatus(404);
  }
});

// Gemini এবং রিপ্লাই হ্যান্ডলার
async function handleGeminiResponse(sender_psid, userMessage) {
  try {
    // ১. টাইপিং অন করা
    await sendTypingAction(sender_psid, "typing_on");

    // ২. Gemini কল করা
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `${SYSTEM_INSTRUCTION}\n\nUser asked: ${userMessage}\nAnswer:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botReply = response.text();

    console.log(`Gemini Replied: ${botReply}`);

    // ৩. টাইপিং অফ করা
    await sendTypingAction(sender_psid, "typing_off");

    // ৪. উত্তর পাঠানো
    await callSendAPI(sender_psid, { text: botReply });

  } catch (error) {
    console.error("Gemini/Send Error:", error.message);
    // এরর হলে সাধারণ মেসেজ পাঠানো
    await callSendAPI(sender_psid, { text: "আমি এখন একটু ব্যস্ত, পরে কথা হবে।" });
  }
}

// মেসেজ সেন্ড ফাংশন
async function callSendAPI(sender_psid, response) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: sender_psid },
        message: response
      }
    );
  } catch (error) {
    console.error("Failed to send message via FB API:", error.response ? error.response.data : error.message);
  }
}

// টাইপিং অ্যাকশন
async function sendTypingAction(sender_psid, action) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: sender_psid },
        sender_action: action
      }
    );
  } catch (error) {
    console.error("Typing indicator failed:", error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
