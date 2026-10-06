export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Pre-warm storage and in-memory caches on container boot
    try {
      const { getDatabase } = await import("@/lib/storage");
      getDatabase();
    } catch (err) {
      console.warn("Storage pre-warm warning:", err);
    }

    // Pre-warm Firebase Admin connection so TLS / gRPC channels are ready
    try {
      const { adminDb } = await import("@/lib/server-auth");
      const db = adminDb();
      db.collection("leagues").limit(1).get().catch(() => {});
    } catch (err) {
      console.warn("Firebase pre-warm warning:", err);
    }
  }
}
