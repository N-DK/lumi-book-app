import Page from "../../page";

export default async function ReadRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <Page />;
}
