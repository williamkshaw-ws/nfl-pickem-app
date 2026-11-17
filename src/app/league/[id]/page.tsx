import type { Metadata } from "next";
import LeagueClient from "./LeagueClient";
import { adminDb } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const METADATA_TIMEOUT_MS = 1500;

/** Single direct lookup (the league API also loads leagues by exact doc ID), capped by a timeout. */
async function loadLeagueName(id: string): Promise<string | null> {
  const cleanId = id.trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(cleanId)) return null;
  const db = adminDb();
  const upper = cleanId.toUpperCase();
  const ids = cleanId === upper ? [cleanId] : [cleanId, upper];
  const snaps = await Promise.all(ids.map((docId) => db.collection("leagues").doc(docId).get()));
  const leagueDoc = snaps.find((s) => s.exists);
  if (!leagueDoc) return null;
  const data = leagueDoc.data();
  return data?.name?.trim() || data?.settings?.leagueName?.trim() || "Pick'em League";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id) {
    const upper = id.trim().toUpperCase();
    try {
      const leagueName = await Promise.race([
        loadLeagueName(id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), METADATA_TIMEOUT_MS)),
      ]);

      if (leagueName) {
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
