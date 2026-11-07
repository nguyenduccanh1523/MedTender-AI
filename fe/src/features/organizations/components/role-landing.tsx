import Link from 'next/link'

import type { Organization } from '../api'
import { roleLabels } from '../roles'
import { canCreateTender } from '../workspace-permissions'

type RoleLandingContent = { headline: string; focus: string; secondary: string; permission: string }

const content: Record<Organization['role'], RoleLandingContent> = {
  OWNER: { headline: 'Điều hành workspace với đầy đủ bối cảnh.', focus: 'Quản trị chính sách tổ chức, phân quyền ADMIN và theo dõi toàn bộ hồ sơ mua sắm.', secondary: 'Quản trị tổ chức', permission: 'Đặc quyền cấu hình tổ chức, quản lý ADMIN, tạo hồ sơ thầu và xuất bản catalog.' },
  ADMIN: { headline: 'Giữ đội ngũ phối hợp đúng vai trò.', focus: 'Quản lý thành viên nghiệp vụ, hồ sơ mua sắm và catalog trong workspace.', secondary: 'Quản trị đội ngũ', permission: 'Tạo hồ sơ thầu, quản lý catalog và mời các role nghiệp vụ.' },
  BID_MANAGER: { headline: 'Điều phối hồ sơ mua sắm.', focus: 'Tạo RFQ, E-HSMT hoặc hồ sơ nội bộ và theo dõi danh sách tender.', secondary: 'Xem hoạt động', permission: 'Tạo và quản lý hồ sơ thầu, lot, item; xem catalog sản phẩm.' },
  ANALYST: { headline: 'Bắt đầu từ hồ sơ nguồn.', focus: 'Đối chiếu yêu cầu kỹ thuật từ hồ sơ thầu với thông số catalog đã xuất bản.', secondary: 'Xem hoạt động', permission: 'Xem hồ sơ thầu và catalog kỹ thuật; chuẩn bị dữ liệu phân tích.' },
  CATALOG_MANAGER: { headline: 'Chuẩn hóa catalog và phiên bản sản phẩm.', focus: 'Quản lý SKU, tạo phiên bản bất biến và chuẩn hóa thông số kỹ thuật có truy vết nguồn.', secondary: 'Mở Catalog thiết bị', permission: 'Tạo, chỉnh sửa bản nháp và xuất bản phiên bản sản phẩm trong catalog.' },
  REVIEWER: { headline: 'Nắm bối cảnh trước khi rà soát.', focus: 'Xem hồ sơ thầu; hàng chờ review sẽ mở khi quy trình phân tích được triển khai.', secondary: 'Xem hoạt động', permission: 'Xem hồ sơ thầu; chưa có thao tác phê duyệt analysis.' },
  VIEWER: { headline: 'Theo dõi thông tin trong workspace.', focus: 'Xem hồ sơ thầu thuộc tổ chức và các thông tin được chia sẻ.', secondary: 'Xem hoạt động', permission: 'Chỉ xem, không tạo hoặc chỉnh sửa hồ sơ.' },
}

export function RoleLanding({ organization }: { organization: Organization }) {
  const data = content[organization.role]
  const isOwner = organization.role === 'OWNER'
  const isAdmin = organization.role === 'ADMIN'
  const isCatalogManager = organization.role === 'CATALOG_MANAGER'
  const secondaryHref = isOwner
    ? `/${organization.slug}/quan-tri-to-chuc`
    : isAdmin
      ? `/${organization.slug}/thanh-vien`
      : isCatalogManager
        ? `/${organization.slug}/catalog`
        : `/${organization.slug}/hoat-dong`
  const secondaryCopy = isOwner
    ? 'Cấu hình chính sách tuân thủ, hạn mức hệ thống và kiểm toán cấp tổ chức.'
    : isAdmin
      ? 'Xem thành viên và lời mời của tổ chức.'
      : isCatalogManager
        ? 'Quản lý SKU, thông số nguồn và xuất bản phiên bản thiết bị.'
        : 'Theo dõi phần hoạt động hiện có trong workspace.'
  return <section className="role-landing" aria-label="Trang bắt đầu workspace">
    <div className="role-landing-intro"><div><p className="eyebrow">{roleLabels[organization.role]} · MedTender workspace</p><h2>{data.headline}</h2><p>{data.focus}</p></div><div className="role-access-badge"><span>Quyền hiện tại</span><strong>{roleLabels[organization.role]}</strong></div></div>
    <div className="role-action-grid">
      <article className="role-action-primary"><span>Điểm bắt đầu</span><h3>{isCatalogManager ? 'Quản lý Catalog thiết bị' : canCreateTender(organization.role) ? 'Quản lý hồ sơ thầu' : 'Xem hồ sơ thầu'}</h3><p>{isCatalogManager ? 'Tạo SKU thiết bị mới, cập nhật bản nháp thông số hoặc xuất bản phiên bản chuẩn.' : canCreateTender(organization.role) ? 'Tạo hồ sơ mới hoặc tiếp tục xem các RFQ, E-HSMT đã có.' : 'Đọc danh sách và chi tiết hồ sơ thuộc tổ chức.'}</p><Link href={`/${organization.slug}/${isCatalogManager ? 'catalog' : 'tenders'}`}>{isCatalogManager ? 'Mở Catalog thiết bị' : 'Mở hồ sơ thầu'} <span aria-hidden="true">→</span></Link></article>
      <article><span>Tiếp tục khám phá</span><h3>{data.secondary}</h3><p>{secondaryCopy}</p><Link href={secondaryHref}>Đi tới <span aria-hidden="true">→</span></Link></article>
      <article><span>Phạm vi quyền</span><h3>{roleLabels[organization.role]}</h3><p>{data.permission}</p></article>
    </div>
  </section>
}
