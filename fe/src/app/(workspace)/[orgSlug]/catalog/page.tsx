import { CatalogList } from '../../../../features/catalog/components/catalog-list'

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <CatalogList slug={orgSlug} />
}
