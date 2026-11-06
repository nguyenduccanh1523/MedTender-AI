import { TenderForm } from '../../../../../features/tenders/components/tender-form'
export default async function NewTenderPage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; return <TenderForm slug={orgSlug} /> }
