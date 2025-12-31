const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// আপনার ভেরিফিকেশন টোকেন (এটি ফেসবুকে সেটআপের সময় লাগবে)
// আপনি চাইলে এটি পরিবর্তন করতে পারেন, তবে মনে রাখতে হবে।
const VERIFY_TOKEN = "my_secret_token_123";

app.use(bodyParser.json());

// ১. রুট চেক (সার্ভার ঠিক আছে কিনা দেখার জন্য)
app.get("/", (req, res) => {
  res.send("Facebook Webhook Server is Running!");
});

// ২. ফেসবুক ভেরিফিকেশন (Facebook Verification Step)
// ফেসবুক যখন আপনার সার্ভার চেক করবে, তখন এই রাউটটি কল হবে।
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

// ৩. ডাটা রিসিভ করা (Handle Incoming Events)
// যখন কেউ মেসেজ বা কমেন্ট করবে, ফেসবুক এই রাউটে ডাটা পাঠাবে।
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      // মেসেজ ইভেন্ট হ্যান্ডেল করা
      const webhook_event = entry.messaging ? entry.messaging[0] : null;
      console.log("Event Received:", webhook_event);
      
      // এখানে আপনি অটোমেশন লজিক (যেমন: ChatGPT কানেক্ট করা) বসাতে পারেন
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
