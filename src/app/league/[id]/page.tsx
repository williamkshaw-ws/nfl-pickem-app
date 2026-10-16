import type { Metadata } from "next";
import LeagueClient from "./LeagueClient";
import { adminDb } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id) {
    const cleanId = id.trim();
    const upper = cleanId.toUpperCase();
    try {
      const db = adminDb();
      let leagueDoc = await db.collection("leagues").doc(upper).get();
      if (!leagueDoc.exists && cleanId !== upper) {
        leagueDoc = await db.collection("leagues").doc(cleanId).get();
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
    } catch (err) {
      console.error("League generateMetadata error:", err);
    }
  }

  const defaultTitle = "NFL Pick'em League | PocketPicks";
  const defaultDesc =
    "Make weekly football picks and compete with friends on PocketPicks!";

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

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <LeagueClient params={params} />;
}
