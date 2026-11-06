import { WorkspaceProfile } from '../../../../features/organizations/components/workspace-profile'

export default async function WorkspaceProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <WorkspaceProfile slug={orgSlug} />
}
