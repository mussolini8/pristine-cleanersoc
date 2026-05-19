import { SeoClient } from "../../seo-client";

export default async function SeoTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SeoClient view="detail" taskId={id} />;
}
