import type { Organization } from './api'

export const roleLabels = {
  OWNER: 'Chủ sở hữu',
  ADMIN: 'Quản trị viên',
  BID_MANAGER: 'Quản lý đấu thầu',
  ANALYST: 'Chuyên viên phân tích',
  CATALOG_MANAGER: 'Quản lý catalog',
  REVIEWER: 'Người duyệt',
  VIEWER: 'Người xem',
} satisfies Record<Organization['role'], string>
