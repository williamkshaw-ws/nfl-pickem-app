import type { Metadata } from "next";
import SquaresClient from "./SquaresClient";
import { adminDb } from "@/lib/server-auth";
import { extractSquaresCode } from "@/lib/squares-validation";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await searchParams;
  const cleanId = id ? extractSquaresCode(id) : null;

  if (cleanId) {
    try {
      const db = adminDb();
      let poolDoc = await db.collection("squares_pools").doc(cleanId).get();
      if (!poolDoc.exists) {
        const qSnap = await db
          .collection("squares_pools")
          .where("joinCode", "==", cleanId)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          poolDoc = qSnap.docs[0];
        }
      }

      if (poolDoc.exists) {
        const pool = poolDoc.data();
        const boardTitle =
          pool?.board?.title?.trim() || pool?.title?.trim() || "Super Bowl Squares Pool";
        const title = `${boardTitle} | Super Bowl Squares`;
        const description = `Join ${boardTitle} on PocketPicks! 10x10 football squares with live score updates, quarterly payouts, and real-time square tracking.`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: `https://pocketpicks.app/squares?id=${cleanId}`,
            siteName: "PocketPicks",
            type: "website",
            images: [
              {
                url: "/icon-512.png",
                width: 512,
                height: 512,
                alt: boardTitle,
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
      console.error("Squares generateMetadata error:", err);
    }
  }

  const defaultTitle = "Super Bowl Squares Pool | PocketPicks";
  const defaultDesc =
    "Run and play 10x10 Super Bowl Squares with friends. Enjoy live score updates, quarterly payouts, and real-time square tracking on PocketPicks!";

  return {
    title: defaultTitle,
    description: defaultDesc,
    openGraph: {
      title: defaultTitle,
      description: defaultDesc,
      url: "https://pocketpicks.app/squares",
      siteName: "PocketPicks",
      type: "website",
      images: [
        {
          url: "/icon-512.png",
          width: 512,
          height: 512,
          alt: "PocketPicks Super Bowl Squares",
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

export default function SquaresPage() {
  return <SquaresClient />;
}
