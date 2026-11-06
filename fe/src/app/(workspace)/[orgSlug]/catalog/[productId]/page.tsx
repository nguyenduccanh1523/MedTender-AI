import { CatalogDetailView } from '../../../../../features/catalog/components/catalog-detail'

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; productId: string }>
}) {
  const { orgSlug, productId } = await params
  return <CatalogDetailView slug={orgSlug} productId={productId} />
}
