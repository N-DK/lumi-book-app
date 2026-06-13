import Page from "../../page";

export default async function BookDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return <Page />;
}
