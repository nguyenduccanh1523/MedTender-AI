import { WorkspaceGovernanceView } from '../../../../features/organizations/components/workspace-governance'

export default async function WorkspaceGovernancePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <WorkspaceGovernanceView slug={orgSlug} />
}
