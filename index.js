import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore/lite";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXgDAmvMsGPMhVC8QbQJn3VU_kwrIIFH8",
  authDomain: "vest-d0b99.firebaseapp.com",
  projectId: "vest-d0b99",
  storageBucket: "vest-d0b99.firebasestorage.app",
  messagingSenderId: "990373452602",
  appId: "1:990373452602:web:818132824aef8eed678e03",
  measurementId: "G-98SQT4YLR2",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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
    await setDoc(doc(db, "users", userId), {
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
      const referrerDoc = doc(db, "users", referralId);
      const referrerSnap = await getDoc(referrerDoc);
      if (referrerSnap.exists()) {
        await updateDoc(referrerDoc, {
          teamCount: increment(1),
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
    const snapshot = await getDoc(doc(db, "users", email));
    if (snapshot.exists() && snapshot.data().password === password) {
      res.json({ message: "Login successful", user: snapshot.data() });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Recharge
app.post("/api/recharge", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists())
      return res.status(404).json({ error: "User not found" });

    const rechargeHistory = [
      ...(userSnap.data().rechargeHistory || []),
      { amount, date: new Date().toISOString() },
    ];
    await updateDoc(userRef, { rechargeHistory });
    res.json({ message: "Recharge recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Withdrawal
app.post("/api/withdraw", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists())
      return res.status(404).json({ error: "User not found" });

    const withdrawalHistory = [
      ...(userSnap.data().withdrawalHistory || []),
      { amount, date: new Date().toISOString() },
    ];
    await updateDoc(userRef, { withdrawalHistory });
    res.json({ message: "Withdrawal recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Daily Activity
app.post("/api/activity", async (req, res) => {
  const { userId, activity } = req.body;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists())
      return res.status(404).json({ error: "User not found" });

    const activities = [
      ...(userSnap.data().activities || []),
      { activity, date: new Date().toISOString() },
    ];
    await updateDoc(userRef, { activities });
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
      },
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
