const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios"); // মেসেজ পাঠানোর জন্য নতুন লাইব্রেরি

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// কনফিগারেশন (আপনার তথ্য এখানে দিন)
// ==========================================
const VERIFY_TOKEN = "my_secret_token_123"; // আগের সেই টোকেন
const PAGE_ACCESS_TOKEN = "1fc371879fb051a62049881ea511a83b"; 
// ==========================================

app.use(bodyParser.json());

// রুট চেক
app.get("/", (req, res) => {
  res.send("Chatbot Server is Running!");
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

// মেসেজ রিসিভ এবং প্রসেসিং
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      // মেসেজ ইভেন্ট আছে কিনা চেক করা
      const webhook_event = entry.messaging ? entry.messaging[0] : null;

      if (webhook_event && webhook_event.message) {
        console.log("Message Received:", webhook_event.message.text);
        
        // প্রেরকের আইডি (যাতে আমরা রিপ্লাই দিতে পারি)
        const sender_psid = webhook_event.sender.id;
        
        // মেসেজ হ্যান্ডেল করা
        handleMessage(sender_psid, webhook_event.message);
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// মেসেজ হ্যান্ডেল করার ফাংশন
function handleMessage(sender_psid, received_message) {
  let response;

  // ১. ইউজার যদি টেক্সট পাঠায়
  if (received_message.text) {
    const userText = received_message.text.toLowerCase();

    // ==== লজিক বা অটোমেশন ====
    if (userText.includes("hello") || userText.includes("hi")) {
      response = { "text": "হ্যালো! আমি আপনার অটোমেটেড অ্যাসিস্ট্যান্ট। কিভাবে সাহায্য করতে পারি?" };
    } else if (userText.includes("price") || userText.includes("dam")) {
      response = { "text": "আমাদের কোর্সের মূল্য ১০,০০০ টাকা।" };
    } else {
      // ডিফল্ট মেসেজ
      response = { "text": `আপনি লিখেছেন: "${received_message.text}"। আমি শীঘ্রই আপনাকে বিস্তারিত জানাচ্ছি।` };
    }
  }

  // ২. মেসেজ সেন্ড করা
  callSendAPI(sender_psid, response);
}

// ফেসবুক API তে মেসেজ পাঠানোর ফাংশন
function callSendAPI(sender_psid, response) {
  const requestBody = {
    recipient: {
      id: sender_psid
    },
    message: response
  };

  axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, requestBody)
    .then(() => {
      console.log('Message sent!');
    })
    .catch((error) => {
      console.error('Unable to send message:', error.response ? error.response.data : error.message);
    });
}

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
