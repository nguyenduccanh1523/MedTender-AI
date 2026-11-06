'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { Organization } from './api'

type WorkspaceRole = Organization['role']

const WorkspaceRoleContext = createContext<WorkspaceRole | null>(null)

export function WorkspaceRoleProvider({ role, children }: { role: WorkspaceRole; children: ReactNode }) {
  return <WorkspaceRoleContext.Provider value={role}>{children}</WorkspaceRoleContext.Provider>
}

export function useWorkspaceRole() {
  return useContext(WorkspaceRoleContext)
}

export function canCreateTender(role: WorkspaceRole | null) {
  return role === 'OWNER' || role === 'ADMIN' || role === 'BID_MANAGER'
}
