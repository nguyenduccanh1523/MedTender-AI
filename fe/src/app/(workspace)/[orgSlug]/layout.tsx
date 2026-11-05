import type { ReactNode } from 'react'

import { WorkspaceAccess } from '../../../features/organizations/components/workspace-access'

export default async function WorkspaceLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <WorkspaceAccess key={orgSlug} slug={orgSlug}>{children}</WorkspaceAccess>
}
