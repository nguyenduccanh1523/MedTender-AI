import { TenderDetailView } from '../../../../../features/tenders/components/tender-detail'
export default async function TenderDetailPage({ params }: { params: Promise<{ orgSlug: string; tenderId: string }> }) { const { orgSlug, tenderId } = await params; return <TenderDetailView slug={orgSlug} id={tenderId} /> }
