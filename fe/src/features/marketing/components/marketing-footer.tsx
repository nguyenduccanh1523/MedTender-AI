import Link from 'next/link'

import { Logo } from '../../../components/brand/logo'

export function MarketingFooter() {
  return (
    <footer className="enterprise-footer-v2" aria-label="Thông tin nền tảng, tài liệu và pháp lý">
      <div className="enterprise-footer-v2-inner">
        <div className="enterprise-footer-v2-top">
          <div className="enterprise-footer-v2-brand">
            <Logo />
            <p>
              Nền tảng chuẩn hóa yêu cầu kỹ thuật, quản lý phiên bản Catalog bất biến và đối chiếu bằng chứng nguồn có
              kiểm soát cho đấu thầu thiết bị y tế.
            </p>
            <div className="enterprise-footer-v2-pills">
              <span>Multi-tenant RBAC</span>
              <span>HttpOnly Session</span>
              <span>SHA-256 Audit</span>
            </div>
          </div>

          <div className="enterprise-footer-v2-col">
            <h3>Nền tảng</h3>
            <ul>
              <li>
                <Link href="/nen-tang">Kiến trúc nền tảng</Link>
              </li>
              <li>
                <Link href="/quy-trinh">Quy trình thẩm định</Link>
              </li>
              <li>
                <Link href="/quan-tri">Mô hình phân quyền</Link>
              </li>
              <li>
                <Link href="/apply">Đăng ký tổ chức</Link>
              </li>
            </ul>
          </div>

          <div className="enterprise-footer-v2-col">
            <h3>Tài liệu & Hướng dẫn</h3>
            <ul>
              <li>
                <Link href="/tai-lieu">Tài liệu hệ thống</Link>
              </li>
              <li>
                <Link href="/tai-lieu">Chuẩn hóa Catalog (v1/v2)</Link>
              </li>
              <li>
                <Link href="/tai-lieu">Nguyên tắc 4 mắt (Reviewer)</Link>
              </li>
              <li>
                <Link href="/login">Cổng đăng nhập Workspace</Link>
              </li>
            </ul>
          </div>

          <div className="enterprise-footer-v2-col">
            <h3>Bảo mật & Pháp lý</h3>
            <ul>
              <li>
                <Link href="/bao-mat">Chính sách Bảo mật (Privacy)</Link>
              </li>
              <li>
                <Link href="/dieu-khoan">Điều khoản Sử dụng (Terms)</Link>
              </li>
              <li>
                <Link href="/bao-mat">Cam kết Không huấn luyện AI ngoài</Link>
              </li>
              <li>
                <Link href="/dieu-khoan">Phân định trách nhiệm phê duyệt</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="enterprise-footer-v2-bottom">
          <p>© 2026 MedTender AI · Hệ thống quản trị hồ sơ thầu và bằng chứng kỹ thuật thiết bị y tế.</p>
          <div className="enterprise-footer-v2-legal">
            <Link href="/tai-lieu">Tài liệu</Link>
            <Link href="/bao-mat">Chính sách bảo mật</Link>
            <Link href="/dieu-khoan">Điều khoản sử dụng</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
