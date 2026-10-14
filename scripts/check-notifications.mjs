import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
}

const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
}

const db = getFirestore();

async function run() {
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} total users in Firestore:\n`);
  usersSnap.docs.forEach(doc => {
    const u = doc.data();
    console.log(`- User: ${u.name || "N/A"} (${u.email || "No email"})`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  emailNotifications: ${u.emailNotifications}`);
    console.log(`  emailVerified: ${u.emailVerified}`);
  });
}

run().catch(console.error);
