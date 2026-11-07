import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { CatalogDetailView } from '../src/features/catalog/components/catalog-detail'
import { CatalogList } from '../src/features/catalog/components/catalog-list'
import { WorkspaceActivityView } from '../src/features/organizations/components/workspace-activity'
import { WorkspaceGovernanceView } from '../src/features/organizations/components/workspace-governance'
import { WorkspaceRoleProvider } from '../src/features/organizations/workspace-permissions'

const {
  listCatalogProductsPage,
  createCatalogProduct,
  getCatalogProduct,
  createCatalogProductVersion,
  publishCatalogProductVersion,
  getWorkspaceActivity,
  getOrganizationGovernance,
} = vi.hoisted(() => ({
  listCatalogProductsPage: vi.fn(),
  createCatalogProduct: vi.fn(),
  getCatalogProduct: vi.fn(),
  createCatalogProductVersion: vi.fn(),
  publishCatalogProductVersion: vi.fn(),
  getWorkspaceActivity: vi.fn(),
  getOrganizationGovernance: vi.fn(),
}))

vi.mock('../src/features/catalog/api', () => ({
  listCatalogProductsPage,
  createCatalogProduct,
  getCatalogProduct,
  createCatalogProductVersion,
  publishCatalogProductVersion,
  updateCatalogProduct: vi.fn(),
  updateCatalogProductVersion: vi.fn(),
  addCatalogSpecification: vi.fn(),
  updateCatalogSpecification: vi.fn(),
  removeCatalogSpecification: vi.fn(),
}))

vi.mock('../src/features/organizations/api', () => ({
  getWorkspaceActivity,
  getOrganizationGovernance,
  updateOrganizationGovernance: vi.fn(),
  updateOrganizationMember: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/org-a/catalog',
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows create product button for CATALOG_MANAGER and hides it for VIEWER', async () => {
  listCatalogProductsPage.mockResolvedValue({
    items: [
      {
        id: 'p-1',
        organizationId: 'org-a',
        sku: 'MON-MINDRAY-12',
        name: 'Monitor theo dõi 5 thông số',
        brand: 'Mindray',
        manufacturer: 'Mindray Bio-Medical',
        category: 'ICU',
        status: 'ACTIVE',
        createdAt: '2026-11-06T08:00:00Z',
        updatedAt: '2026-11-06T09:00:00Z',
        versionCount: 2,
        latestVersion: {
          id: 'v-2',
          productId: 'p-1',
          versionNumber: 2,
          versionLabel: 'v2',
          modelCode: 'MEC-1200-V2',
          status: 'PUBLISHED',
          fingerprint: 'sha256:abcdef123456',
          notes: null,
          publishedAt: '2026-11-06T09:00:00Z',
          createdAt: '2026-11-06T08:30:00Z',
          updatedAt: '2026-11-06T09:00:00Z',
          specificationCount: 4,
          conflictCount: 1,
        },
        publishedVersion: {
          id: 'v-2',
          productId: 'p-1',
          versionNumber: 2,
          versionLabel: 'v2',
          modelCode: 'MEC-1200-V2',
          status: 'PUBLISHED',
          fingerprint: 'sha256:abcdef123456',
          notes: null,
          publishedAt: '2026-11-06T09:00:00Z',
          createdAt: '2026-11-06T08:30:00Z',
          updatedAt: '2026-11-06T09:00:00Z',
          specificationCount: 4,
          conflictCount: 1,
        },
      },
    ],
    nextCursor: null,
    total: 1,
  })

  const { unmount } = render(
    <WorkspaceRoleProvider role="CATALOG_MANAGER">
      <CatalogList slug="org-a" />
    </WorkspaceRoleProvider>,
  )

  expect(await screen.findByText('Monitor theo dõi 5 thông số')).toBeTruthy()
  expect(screen.getByRole('button', { name: '+ Thêm sản phẩm' })).toBeTruthy()
  expect(screen.getByText(/1 thông số xung đột nguồn/)).toBeTruthy()

  unmount()

  render(
    <WorkspaceRoleProvider role="VIEWER">
      <CatalogList slug="org-a" />
    </WorkspaceRoleProvider>,
  )
  expect(await screen.findByText('Monitor theo dõi 5 thông số')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '+ Thêm sản phẩm' })).toBeNull()
})

it('preserves historical v1 specifications while viewing v2 and highlights conflicting sources', async () => {
  getCatalogProduct.mockResolvedValue({
    id: 'p-1',
    organizationId: 'org-a',
    sku: 'MON-MINDRAY-12',
    name: 'Monitor theo dõi 5 thông số',
    brand: 'Mindray',
    manufacturer: 'Mindray Bio-Medical',
    category: 'ICU',
    status: 'ACTIVE',
    createdAt: '2026-11-06T08:00:00Z',
    updatedAt: '2026-11-06T09:00:00Z',
    versionCount: 2,
    latestVersion: null,
    publishedVersion: null,
    versions: [
      {
        id: 'v-2',
        productId: 'p-1',
        versionNumber: 2,
        versionLabel: 'v2',
        modelCode: 'MEC-1200-Pro',
        status: 'DRAFT',
        fingerprint: 'sha256:v2fingerprint',
        notes: 'Bản nâng cấp pin 2026',
        publishedAt: null,
        createdAt: '2026-11-06T09:00:00Z',
        updatedAt: '2026-11-06T09:00:00Z',
        specificationCount: 2,
        conflictCount: 1,
        specifications: [
          {
            id: 's-1',
            productVersionId: 'v-2',
            specKey: 'Thời lượng pin',
            specValue: '120',
            unit: 'phút',
            sourceLabel: 'Brochure 2025',
            sourceQuote: 'Pin dự phòng 120 phút',
            documentVersionId: null,
            hasConflict: true,
            createdAt: '2026-11-06T09:00:00Z',
          },
          {
            id: 's-2',
            productVersionId: 'v-2',
            specKey: 'Thời lượng pin',
            specValue: '180',
            unit: 'phút',
            sourceLabel: 'Tờ khai CFS 2026',
            sourceQuote: 'Pin dự phòng 180 phút',
            documentVersionId: null,
            hasConflict: true,
            createdAt: '2026-11-06T09:01:00Z',
          },
        ],
      },
      {
        id: 'v-1',
        productId: 'p-1',
        versionNumber: 1,
        versionLabel: 'v1',
        modelCode: 'MEC-1200-Base',
        status: 'PUBLISHED',
        fingerprint: 'sha256:v1fingerprint',
        notes: 'Bản chuẩn ban đầu',
        publishedAt: '2026-11-06T08:00:00Z',
        createdAt: '2026-11-06T08:00:00Z',
        updatedAt: '2026-11-06T08:00:00Z',
        specificationCount: 1,
        conflictCount: 0,
        specifications: [
          {
            id: 's-v1',
            productVersionId: 'v-1',
            specKey: 'Kích thước màn hình',
            specValue: '12.1',
            unit: 'inch',
            sourceLabel: 'IFU gốc v1',
            sourceQuote: 'Màn hình TFT 12.1 inch',
            documentVersionId: null,
            hasConflict: false,
            createdAt: '2026-11-06T08:00:00Z',
          },
        ],
      },
    ],
  })

  render(
    <WorkspaceRoleProvider role="CATALOG_MANAGER">
      <CatalogDetailView slug="org-a" productId="p-1" />
    </WorkspaceRoleProvider>,
  )

  // Defaults to PUBLISHED version (v1) first, showing v1's intact spec & immutable lock
  expect(await screen.findByRole('heading', { name: 'Model: MEC-1200-Base' })).toBeTruthy()
  expect(screen.getByText('Kích thước màn hình')).toBeTruthy()
  expect(screen.getByText(/Đã khóa bất biến/)).toBeTruthy()

  // Switch to v2 tab -> shows v2's conflicting specs & publish button
  fireEvent.click(screen.getByRole('tab', { name: /v2/i }))
  expect(await screen.findByRole('heading', { name: 'Model: MEC-1200-Pro' })).toBeTruthy()
  expect(screen.getByText('Nguồn: Brochure 2025')).toBeTruthy()
  expect(screen.getByText('Nguồn: Tờ khai CFS 2026')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Xuất bản v2' })).toBeTruthy()
})

it('renders role-tailored operational dashboard in Hoạt động and blocks ADMIN from OWNER governance page', async () => {
  getWorkspaceActivity.mockResolvedValue({
    role: 'CATALOG_MANAGER',
    metrics: {
      tendersCount: 3,
      lotsCount: 5,
      itemsCount: 18,
      productsCount: 6,
      publishedVersionsCount: 4,
      draftVersionsCount: 2,
      conflictingSpecsCount: 1,
      membersCount: null,
      pendingInvitationsCount: null,
    },
    workQueue: [
      {
        id: 'q-1',
        category: 'Chuẩn hóa thông số',
        priority: 'HIGH',
        title: 'Xử lý 1 thông số kỹ thuật đang xung đột nguồn',
        description: 'Đối chiếu tài liệu nguồn và thống nhất giá trị thông số.',
        href: '/org-a/catalog',
        ctaLabel: 'Mở Catalog thiết bị',
        meta: '1 xung đột',
      },
    ],
    timeline: [],
  })

  render(<WorkspaceActivityView slug="org-a" />)
  expect(
    await screen.findByText('Trung tâm chuẩn hóa SKU, phiên bản bất biến & thông số kỹ thuật'),
  ).toBeTruthy()
  expect(screen.getByText('Xử lý 1 thông số kỹ thuật đang xung đột nguồn')).toBeTruthy()
  expect(screen.getByRole('tab', { name: /Nhật ký sự kiện \(Log\)/i })).toBeTruthy()

  // ADMIN opening OWNER governance view is blocked
  render(
    <WorkspaceRoleProvider role="ADMIN">
      <WorkspaceGovernanceView slug="org-a" />
    </WorkspaceRoleProvider>,
  )
  expect(
    await screen.findByText('Chức năng này chỉ dành riêng cho OWNER của tổ chức'),
  ).toBeTruthy()
})
