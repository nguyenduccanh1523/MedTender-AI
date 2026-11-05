import Link from 'next/link'

import { Logo } from '../../components/brand/logo'
import { OrganizationApplicationForm } from '../../features/provisioning/components/organization-application-form'

export default function ApplyPage() {
  return (
    <div className="public-shell">
      <header className="app-header"><div className="app-header-row"><Logo /><nav aria-label="Điều hướng"><Link href="/login">Đăng nhập</Link></nav></div></header>
      <main className="application-page">
        <aside className="application-intro">
          <p className="eyebrow">Đăng ký sử dụng</p>
          <h1>Đưa tổ chức của bạn vào MedTender AI</h1>
          <p>Gửi thông tin xác minh. System Admin sẽ duyệt hồ sơ trước khi workspace và tài khoản OWNER được khởi tạo.</p>
          <ol><li><span>01</span> Gửi thông tin tổ chức</li><li><span>02</span> MedTender AI xác minh và phê duyệt</li><li><span>03</span> Nhận email kích hoạt tài khoản OWNER</li></ol>
        </aside>
        <section className="application-card"><OrganizationApplicationForm /></section>
      </main>
    </div>
  )
}
