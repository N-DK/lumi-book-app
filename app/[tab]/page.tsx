import { notFound } from "next/navigation";
import Page from "../page";

const TABS = new Set(["discover", "for-you", "me", "favorites", "recent"]);

export default async function TabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!TABS.has(tab)) notFound();

  return <Page />;
}
