import Link from 'next/link'

import type { Organization } from '../api'
import { roleLabels } from '../roles'
import { canCreateTender } from '../workspace-permissions'

type RoleLandingContent = { headline: string; focus: string; secondary: string; permission: string }

const content: Record<Organization['role'], RoleLandingContent> = {
  OWNER: { headline: 'Điều hành workspace với đầy đủ bối cảnh.', focus: 'Quản lý thành viên và theo dõi hồ sơ mua sắm của tổ chức.', secondary: 'Quản trị đội ngũ', permission: 'Tạo hồ sơ thầu và mời thành viên, bao gồm ADMIN.' },
  ADMIN: { headline: 'Giữ đội ngũ phối hợp đúng vai trò.', focus: 'Quản lý thành viên nghiệp vụ và hồ sơ mua sắm trong workspace.', secondary: 'Quản trị đội ngũ', permission: 'Tạo hồ sơ thầu và mời các role nghiệp vụ.' },
  BID_MANAGER: { headline: 'Điều phối hồ sơ mua sắm.', focus: 'Tạo RFQ, E-HSMT hoặc hồ sơ nội bộ và theo dõi danh sách tender.', secondary: 'Xem hoạt động', permission: 'Tạo hồ sơ thầu; không quản trị thành viên.' },
  ANALYST: { headline: 'Bắt đầu từ hồ sơ nguồn.', focus: 'Xem hồ sơ thầu để chuẩn bị cho quy trình phân tích khi module được triển khai.', secondary: 'Xem hoạt động', permission: 'Xem hồ sơ thầu; chưa có chức năng nhập tài liệu và phân tích.' },
  CATALOG_MANAGER: { headline: 'Theo dõi nhu cầu từ hồ sơ thầu.', focus: 'Xem hồ sơ mua sắm để chuẩn bị dữ liệu catalog cho giai đoạn tiếp theo.', secondary: 'Xem hoạt động', permission: 'Xem hồ sơ thầu; module catalog chưa được triển khai.' },
  REVIEWER: { headline: 'Nắm bối cảnh trước khi rà soát.', focus: 'Xem hồ sơ thầu; hàng chờ review sẽ mở khi quy trình phân tích được triển khai.', secondary: 'Xem hoạt động', permission: 'Xem hồ sơ thầu; chưa có thao tác phê duyệt analysis.' },
  VIEWER: { headline: 'Theo dõi thông tin trong workspace.', focus: 'Xem hồ sơ thầu thuộc tổ chức và các thông tin được chia sẻ.', secondary: 'Xem hoạt động', permission: 'Chỉ xem, không tạo hoặc chỉnh sửa hồ sơ.' },
}

export function RoleLanding({ organization }: { organization: Organization }) {
  const data = content[organization.role]
  const canManageTeam = organization.role === 'OWNER' || organization.role === 'ADMIN'
  return <section className="role-landing" aria-label="Trang bắt đầu workspace">
    <div className="role-landing-intro"><div><p className="eyebrow">{roleLabels[organization.role]} · MedTender workspace</p><h2>{data.headline}</h2><p>{data.focus}</p></div><div className="role-access-badge"><span>Quyền hiện tại</span><strong>{roleLabels[organization.role]}</strong></div></div>
    <div className="role-action-grid">
      <article className="role-action-primary"><span>Điểm bắt đầu</span><h3>{canCreateTender(organization.role) ? 'Quản lý hồ sơ thầu' : 'Xem hồ sơ thầu'}</h3><p>{canCreateTender(organization.role) ? 'Tạo hồ sơ mới hoặc tiếp tục xem các RFQ, E-HSMT đã có.' : 'Đọc danh sách và chi tiết hồ sơ thuộc tổ chức.'}</p><Link href={`/${organization.slug}/tenders`}>Mở hồ sơ thầu <span aria-hidden="true">→</span></Link></article>
      <article><span>Tiếp tục khám phá</span><h3>{data.secondary}</h3><p>{canManageTeam ? 'Xem thành viên và lời mời của tổ chức.' : 'Theo dõi phần hoạt động hiện có trong workspace.'}</p><Link href={`/${organization.slug}/${canManageTeam ? 'thanh-vien' : 'hoat-dong'}`}>Đi tới <span aria-hidden="true">→</span></Link></article>
      <article><span>Phạm vi quyền</span><h3>{roleLabels[organization.role]}</h3><p>{data.permission}</p></article>
    </div>
  </section>
}
