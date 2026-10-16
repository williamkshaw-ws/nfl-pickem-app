import type { Metadata } from "next";
import BracketClient from "./BracketClient";
import { adminDb } from "@/lib/server-auth";
import { extractBracketCode } from "@/lib/playoff-bracket";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await searchParams;
  const cleanId = id ? extractBracketCode(id) : null;

  if (cleanId) {
    try {
      const db = adminDb();
      let poolDoc = await db.collection("bracket_pools").doc(cleanId).get();
      if (!poolDoc.exists) {
        const qSnap = await db
          .collection("bracket_pools")
          .where("joinCode", "==", cleanId)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          poolDoc = qSnap.docs[0];
        }
      }

      if (poolDoc.exists) {
        const pool = poolDoc.data();
        const poolName = pool?.name?.trim() || "Playoff Bracket Challenge";
        const title = `${poolName} | NFL Playoff Bracket`;
        const description = `Join ${poolName} on PocketPicks! Make your playoff game picks, predict the Super Bowl winner, and compete on the leaderboard.`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: `https://pocketpicks.app/bracket?id=${cleanId}`,
            siteName: "PocketPicks",
            type: "website",
            images: [
              {
                url: "/icon-512.png",
                width: 512,
                height: 512,
                alt: poolName,
              },
            ],
          },
          twitter: {
            card: "summary",
            title,
            description,
            images: ["/icon-512.png"],
          },
        };
      }
    } catch (err) {
      console.error("Bracket generateMetadata error:", err);
    }
  }

  const defaultTitle = "NFL Playoff Bracket Challenge | PocketPicks";
  const defaultDesc =
    "Fill out your NFL Playoff Bracket, predict game winners and scores, and compete on the leaderboard with friends on PocketPicks!";

  return {
    title: defaultTitle,
    description: defaultDesc,
    openGraph: {
      title: defaultTitle,
      description: defaultDesc,
      url: "https://pocketpicks.app/bracket",
      siteName: "PocketPicks",
      type: "website",
      images: [
        {
          url: "/icon-512.png",
          width: 512,
          height: 512,
          alt: "PocketPicks NFL Playoff Bracket Challenge",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: defaultTitle,
      description: defaultDesc,
      images: ["/icon-512.png"],
    },
  };
}

export default function BracketPage() {
  return <BracketClient />;
}
