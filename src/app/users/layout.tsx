import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Users | PocketPicks",
  robots: {
    index: false,
    follow: false,
  },
};

export default function UsersAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
