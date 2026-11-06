import { TenderList } from '../../../../features/tenders/components/tender-list'
export default async function TendersPage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; return <TenderList slug={orgSlug} /> }
