'use client'

import { use } from 'react'
import { DocumentsManagementView } from '../../../../features/documents/components/documents-management-view'

export default function DocumentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = use(params)
  return <DocumentsManagementView slug={orgSlug} />
}
