import type { ReactNode } from 'react'

import { Logo } from '../../components/brand/logo'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <div className="auth-main">
        <header className="auth-header"><Logo /></header>
        <div className="auth-content">{children}</div>
        <footer className="auth-footer">MedTender AI · Không gian làm việc dành cho tổ chức</footer>
      </div>
      <aside className="auth-aside">
        <div className="auth-aside-content">
          <p className="eyebrow">Hồ sơ thầu thiết bị y tế</p>
          <h2>Mỗi yêu cầu đều cần bằng chứng.</h2>
          <p>Một nơi để đội ngũ rà soát hồ sơ, đối chiếu thông số và truy lại tài liệu gốc.</p>
          <ul className="auth-points">
            <li><span>01</span> Quản lý theo tổ chức</li>
            <li><span>02</span> Phân quyền theo vai trò</li>
            <li><span>03</span> Truy vết đến nguồn</li>
          </ul>
        </div>
      </aside>
    </main>
  )
}
