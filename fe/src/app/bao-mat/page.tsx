import Link from 'next/link'

import { MarketingFooter } from '../../features/marketing/components/marketing-footer'
import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const securityFoundations = [
  [
    'Cô lập dữ liệu Đa tổ chức (Multi-tenant Isolation)',
    'Mọi truy vấn cơ sở dữ liệu bắt buộc đi qua ngữ cảnh (userId, organizationId). Không một tổ chức nào có thể đọc hoặc suy diễn dữ liệu của tổ chức khác.',
  ],
  [
    'Xác thực HttpOnly & Chống đánh cắp phiên',
    'Token xác thực được lưu trong Cookie HttpOnly, SameSite=Lax kết hợp cơ chế Refresh Token Rotation tự động thu hồi chuỗi phiên nếu phát hiện bất thường.',
  ],
  [
    'Cam kết Không huấn luyện AI công cộng',
    'Ở mức phân loại CONFIDENTIAL và RESTRICTED, chính sách External AI bị khóa cứng ở mức OFF — dữ liệu thầu tuyệt đối không gửi ra mô hình AI bên ngoài.',
  ],
]

export default function PrivacySecurityPage() {
  return (
    <main className="enterprise-page platform-page governance-v2">
      <MarketingHeader />

      <section className="platform-hero">
        <div>
          <p className="eyebrow">CHÍNH SÁCH BẢO MẬT & AN TOÀN THÔNG TIN</p>
          <h1>Bảo vệ tuyệt đối hồ sơ mời thầu và bí mật kỹ thuật y tế.</h1>
          <p>
            MedTender AI áp dụng kiến trúc phòng thủ nhiều lớp (Defense-in-Depth), cô lập dữ liệu cấp độ Tenant và trao
            toàn quyền kiểm soát nhãn bảo mật dữ liệu cho Chủ sở hữu tổ chức (OWNER).
          </p>
          <div className="marketing-actions">
            <Link className="button enterprise-cta" href="/apply">
              Đăng ký tổ chức
            </Link>
            <Link className="marketing-text-link" href="/dieu-khoan">
              Xem điều khoản sử dụng →
            </Link>
          </div>
        </div>
        <aside className="platform-structure" aria-label="Tiêu chuẩn bảo mật dữ liệu">
          <p>TIÊU CHUẨN AN TOÀN</p>
          <strong>HttpOnly Session</strong>
          <i />
          <strong>Zero External AI</strong>
          <i />
          <strong>SHA-256 Integrity</strong>
          <i />
          <strong>Audit Trail 100%</strong>
          <span>Hiệu lực: Năm 2026 · Tuân thủ Đa tổ chức</span>
        </aside>
      </section>

      <section className="platform-foundations" aria-label="Ba nguyên tắc bảo mật cốt lõi">
        {securityFoundations.map(([title, copy], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="platform-evidence" aria-label="Phân loại dữ liệu và quyền riêng tư">
        <div>
          <p className="eyebrow">KIỂM SOÁT DỮ LIỆU & QUYỀN RIÊNG TƯ</p>
          <h2>Dữ liệu thuộc quyền sở hữu của tổ chức tạo lập.</h2>
          <p>
            Chúng tôi chỉ thu thập thông tin tối thiểu cần thiết để xác thực danh tính người dùng, phân quyền RBAC và
            ghi nhận lịch sử kiểm toán phục vụ thanh tra nội bộ của chính tổ chức bạn.
          </p>
        </div>
        <dl>
          <div>
            <dt>Định danh</dt>
            <dd>Họ tên hiển thị, địa chỉ email công vụ và mật khẩu băm một chiều (Argon2 / Bcrypt).</dd>
          </div>
          <div>
            <dt>Hồ sơ & Catalog</dt>
            <dd>
              Toàn bộ E-HSMT, cấu trúc Lot/Item, thông số SKU và trích dẫn nguồn thuộc quyền sở hữu độc quyền của
              Workspace.
            </dd>
          </div>
          <div>
            <dt>Phân loại mật</dt>
            <dd>
              Hỗ trợ 3 cấp độ: <code>INTERNAL</code> (Nội bộ), <code>CONFIDENTIAL</code> (Bảo mật cao) và{' '}
              <code>RESTRICTED</code> (Tuyệt mật).
            </dd>
          </div>
          <div>
            <dt>Lưu vết Audit</dt>
            <dd>
              Nhật ký kiểm toán chỉ hiển thị cho <code>OWNER</code> và <code>ADMIN</code>, ngăn chặn rò rỉ thông tin vận
              hành nội bộ.
            </dd>
          </div>
        </dl>
      </section>

      <section className="governance-v2-closing">
        <div>
          <p className="eyebrow">AN TOÀN & MINH BẠCH</p>
          <h2>Sẵn sàng triển khai cho bệnh viện và doanh nghiệp thiết bị y tế.</h2>
        </div>
        <Link className="button enterprise-cta" href="/apply">
          Đăng ký tổ chức
        </Link>
      </section>

      <MarketingFooter />
    </main>
  )
}
