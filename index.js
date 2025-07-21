import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import admin from "firebase-admin";
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ✅ Home route to confirm server is running
app.get("/", (req, res) => {
  res.send("✅ Backend server is running. Ready to receive API requests!");
});

// ✅ User Signup
app.post("/api/signup", async (req, res) => {
  const { username, email, password, referralId } = req.body;
  const userId = uuidv4();
  const referralLink = `https://vestapp.com/signup?ref=${userId}`;

  try {
    await db.collection("users").doc(userId).set({
      username,
      email,
      password,
      referralId: referralId || null,
      referralLink,
      rechargeHistory: [],
      withdrawalHistory: [],
      activities: [],
      teamCount: 0,
    });

    if (referralId) {
      const referrerRef = db.collection("users").doc(referralId);
      const referrerSnap = await referrerRef.get();
      if (referrerSnap.exists) {
        await referrerRef.update({
          teamCount: admin.firestore.FieldValue.increment(1),
        });
      }
    }

    res.status(201).json({ userId, referralLink });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Sign In
app.post("/api/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      if (userData.password === password) {
        return res.json({ message: "Login successful", user: userData });
      }
    }
    res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Recharge
app.post("/api/recharge", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data();
    const rechargeHistory = [
      ...(userData.rechargeHistory || []),
      { amount, date: new Date().toISOString() },
    ];
    await userRef.update({ rechargeHistory });
    res.json({ message: "Recharge recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Withdrawal
app.post("/api/withdraw", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data();
    const withdrawalHistory = [
      ...(userData.withdrawalHistory || []),
      { amount, date: new Date().toISOString() },
    ];
    await userRef.update({ withdrawalHistory });
    res.json({ message: "Withdrawal recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Daily Activity
app.post("/api/activity", async (req, res) => {
  const { userId, activity } = req.body;
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data();
    const activities = [
      ...(userData.activities || []),
      { activity, date: new Date().toISOString() },
    ];
    await userRef.update({ activities });
    res.json({ message: "Activity recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Paystack Payment
app.post("/api/pay", async (req, res) => {
  const { email, amount } = req.body;
  const secretKey = "sk_live_19a1224ef227142509c9255db0ccd8ccb5e09e15";
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: amount * 100 },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
