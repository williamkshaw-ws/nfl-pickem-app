import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { adminDb } from "@/lib/server-auth";
import { extractSquaresCode } from "@/lib/squares-validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ join?: string; id?: string; code?: string }>;
}): Promise<Metadata> {
  const { join, id, code } = await searchParams;
  const rawParam = join || id || code;

  if (rawParam) {
    const cleanParam = extractSquaresCode(rawParam);
    const upper = cleanParam.toUpperCase();

    if (upper) {
      try {
        const db = adminDb();

        // 1. Check Pick'em Leagues
        let leagueDoc = await db.collection("leagues").doc(upper).get();
        if (!leagueDoc.exists && cleanParam !== upper) {
          leagueDoc = await db.collection("leagues").doc(cleanParam).get();
        }
        if (!leagueDoc.exists) {
          const qSnap = await db
            .collection("leagues")
            .where("id", "==", upper)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            leagueDoc = qSnap.docs[0];
          }
        }
        if (!leagueDoc.exists) {
          const qSnap = await db
            .collection("leagues")
            .where("inviteCode", "==", upper)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            leagueDoc = qSnap.docs[0];
          }
        }

        if (leagueDoc && leagueDoc.exists) {
          const data = leagueDoc.data();
          const leagueName =
            data?.name?.trim() ||
            data?.settings?.leagueName?.trim() ||
            "Pick'em League";
          const title = `${leagueName} | NFL Pick'em`;
          const description = `Join ${leagueName} on PocketPicks! Make weekly NFL picks, compete with friends, and track season standings.`;
          return {
            title,
            description,
            openGraph: {
              title,
              description,
              url: `https://pocketpicks.app/league/${encodeURIComponent(upper)}`,
              siteName: "PocketPicks",
              type: "website",
            },
            twitter: {
              title,
              description,
            },
          };
        }

        // 2. Check Squares Pools
        let squaresDoc = await db.collection("squares_pools").doc(upper).get();
        if (!squaresDoc.exists && cleanParam !== upper) {
          squaresDoc = await db.collection("squares_pools").doc(cleanParam).get();
        }
        if (!squaresDoc.exists) {
          const qSnap = await db
            .collection("squares_pools")
            .where("joinCode", "==", upper)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            squaresDoc = qSnap.docs[0];
          }
        }

        if (squaresDoc && squaresDoc.exists) {
          const pool = squaresDoc.data();
          const boardTitle =
            pool?.board?.title?.trim() ||
            pool?.title?.trim() ||
            "Super Bowl Squares Pool";
          const title = `${boardTitle} | Super Bowl Squares`;
          const description = `Join ${boardTitle} on PocketPicks! 10x10 football squares with live score updates, quarterly payouts, and real-time square tracking.`;
          return {
            title,
            description,
            openGraph: {
              title,
              description,
              url: `https://pocketpicks.app/squares?id=${encodeURIComponent(upper)}`,
              siteName: "PocketPicks",
              type: "website",
            },
            twitter: {
              title,
              description,
            },
          };
        }

        // 3. Check Bracket Pools
        let bracketDoc = await db.collection("bracket_pools").doc(upper).get();
        if (!bracketDoc.exists && cleanParam !== upper) {
          bracketDoc = await db.collection("bracket_pools").doc(cleanParam).get();
        }
        if (!bracketDoc.exists) {
          const qSnap = await db
            .collection("bracket_pools")
            .where("joinCode", "==", upper)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            bracketDoc = qSnap.docs[0];
          }
        }

        if (bracketDoc && bracketDoc.exists) {
          const pool = bracketDoc.data();
          const poolName = pool?.name?.trim() || "Playoff Bracket Challenge";
          const title = `${poolName} | NFL Playoff Bracket`;
          const description = `Join ${poolName} on PocketPicks! Make your playoff game picks, predict the Super Bowl winner, and compete on the leaderboard.`;
          return {
            title,
            description,
            openGraph: {
              title,
              description,
              url: `https://pocketpicks.app/bracket?id=${encodeURIComponent(upper)}`,
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
