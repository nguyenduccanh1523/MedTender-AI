import { WorkspaceActivityView } from '../../../../features/organizations/components/workspace-activity'

export default async function WorkspaceActivityPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <WorkspaceActivityView slug={orgSlug} />
}
