import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { adminDb } from "@/lib/server-auth";
import { extractSquaresCode } from "@/lib/squares-validation";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}): Promise<Metadata> {
  const { join } = await searchParams;
  if (join) {
    const cleanJoin = extractSquaresCode(join);
    if (cleanJoin) {
      try {
        const db = adminDb();
        let leagueDoc = await db.collection("leagues").doc(cleanJoin).get();
        if (!leagueDoc.exists) {
          const qSnap = await db
            .collection("leagues")
            .where("inviteCode", "==", cleanJoin.toUpperCase())
            .limit(1)
            .get();
          if (!qSnap.empty) {
            leagueDoc = qSnap.docs[0];
          }
        }
        if (leagueDoc.exists) {
          const data = leagueDoc.data();
          const leagueName = data?.name?.trim() || "Pick'em League";
          const title = `${leagueName} | NFL Pick'em`;
          const description = `Join ${leagueName} on PocketPicks! Make weekly NFL picks, compete with friends, and track season standings.`;
          return {
            title,
            description,
            openGraph: {
              title,
              description,
              url: `https://pocketpicks.app/?join=${encodeURIComponent(cleanJoin)}`,
              siteName: "PocketPicks",
              type: "website",
            },
            twitter: {
              title,
              description,
            },
          };
        }
      } catch (err) {
        console.error("Home generateMetadata error:", err);
      }
    }
  }

  const defaultTitle = "PocketPicks™ | Weekly Football Picks & Standings";
  const defaultDesc =
    "Make weekly football picks, compete with friends, track weekly winners, and battle for the season championship with PocketPicks!";

  return {
    title: defaultTitle,
    description: defaultDesc,
    openGraph: {
      title: defaultTitle,
      description: defaultDesc,
      url: "https://pocketpicks.app",
      siteName: "PocketPicks",
      type: "website",
    },
    twitter: {
      title: defaultTitle,
      description: defaultDesc,
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
