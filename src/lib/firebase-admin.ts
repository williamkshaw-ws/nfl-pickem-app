import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let formatted = key.trim();
  // Strip outer quotes if present (handles single or double quotes, including nested quotes like '"..."')
  while (
    (formatted.startsWith('"') && formatted.endsWith('"')) ||
    (formatted.startsWith("'") && formatted.endsWith("'"))
  ) {
    formatted = formatted.slice(1, -1).trim();
  }
  // Replace escaped \r\n or \n with actual newlines
  return formatted.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      `Firebase Admin credentials incomplete: projectId=${Boolean(projectId)}, clientEmail=${Boolean(clientEmail)}, privateKey=${Boolean(privateKey)}. Please check your environment variables.`
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

/**
 * Returns the Firebase Admin Auth instance, initializing the Admin app lazily if needed.
 */
export function getAdminAuth(): Auth {
  getFirebaseAdminApp();
  return getAuth();
}

/**
 * Proxy object for backwards compatibility with `import { adminAuth } from "@/lib/firebase-admin"`.
 * Defers getAuth() until a method or property is accessed at runtime, preventing Next.js build-time crashes.
 */
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const auth = getAdminAuth();
    const value = (auth as any)[prop];
    return typeof value === 'function' ? value.bind(auth) : value;
  },
});

