import Link from 'next/link'

import { MarketingFooter } from '../../features/marketing/components/marketing-footer'
import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const termsPillars = [
  [
    'AI là Công cụ Hỗ trợ, Không phải Người ký duyệt',
    'Kết quả phân tích (PASS, FAIL, UNKNOWN, NEEDS REVIEW) là trạng thái kỹ thuật dựa trên tài liệu nguồn. Quyết định phê duyệt pháp lý thuộc về con người.',
  ],
  [
    'Nguyên tắc 4 mắt (Four-Eyes Principle)',
    'Chuyên viên lập hồ sơ hoặc chạy phân tích (ANALYST / BID_MANAGER) không tự phê duyệt kết quả của chính mình khi tổ chức bật chế độ bắt buộc REVIEWER độc lập.',
  ],
  [
    'Toàn vẹn Bằng chứng & Không sửa lịch sử',
    'Người dùng cam kết trích dẫn đúng nguồn tài liệu (Brochure, IFU, CFS, ISO). Các phiên bản Catalog đã xuất bản được khóa bất biến để bảo vệ tính trung thực.',
  ],
]

export default function TermsOfServicePage() {
  return (
    <main className="enterprise-page platform-page governance-v2">
      <MarketingHeader />

      <section className="platform-hero">
        <div>
          <p className="eyebrow">ĐIỀU KHOẢN SỬ DỤNG & QUY TẮC QUẢN TRỊ AI</p>
          <h1>Trách nhiệm pháp lý rõ ràng trong từng bước thẩm định.</h1>
          <p>
            Các điều khoản dưới đây quy định quyền và nghĩa vụ của Tổ chức, Chủ sở hữu (OWNER) và các thành viên nghiệp
            vụ khi vận hành hồ sơ thầu thiết bị y tế trên nền tảng MedTender AI.
          </p>
          <div className="marketing-actions">
            <Link className="button enterprise-cta" href="/apply">
              Đăng ký tổ chức
            </Link>
            <Link className="marketing-text-link" href="/bao-mat">
              Xem chính sách bảo mật →
            </Link>
          </div>
        </div>
        <aside className="platform-structure" aria-label="Nguyên tắc trách nhiệm pháp lý">
          <p>NGUYÊN TẮC TRÁCH NHIỆM</p>
          <strong>Verified Entity</strong>
          <i />
          <strong>Role Accountability</strong>
          <i />
          <strong>Four-Eyes Review</strong>
          <i />
          <strong>Human Approval</strong>
          <span>Con người chịu trách nhiệm cuối cùng</span>
        </aside>
      </section>

      <section className="platform-foundations" aria-label="Ba nguyên tắc điều khoản sử dụng">
        {termsPillars.map(([title, copy], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="platform-evidence" aria-label="Quy định về quyền và hạn mức vận hành">
        <div>
          <p className="eyebrow">QUY ĐỊNH VẬN HÀNH WORKSPACE</p>
          <h2>Phân định rõ thẩm quyền từ cấp Nền tảng đến từng Thành viên.</h2>
          <p>
            Mỗi thao tác trên hệ thống đều gắn liền với định danh cá nhân và vai trò được cấp tại tổ chức tại đúng thời
            điểm thực hiện.
          </p>
        </div>
        <dl>
          <div>
            <dt>Phê duyệt</dt>
            <dd>
              Workspace chỉ được mở sau khi System Admin xác minh hồ sơ đăng ký pháp nhân hợp lệ của Bệnh viện hoặc Nhà
              thầu.
            </dd>
          </div>
          <div>
            <dt>Chủ sở hữu</dt>
            <dd>
              <code>OWNER</code> chịu trách nhiệm toàn diện về việc bổ nhiệm <code>ADMIN</code>, quản lý thành viên và
              cấu hình hạn mức vận hành của tổ chức.
            </dd>
          </div>
          <div>
            <dt>Hạn mức</dt>
            <dd>
              Hệ thống áp dụng hạn mức an toàn (mặc định 20 Lot / 100 Item mỗi hồ sơ thầu; 200 thông số mỗi phiên bản
              Catalog) và cho phép <code>OWNER</code> điều chỉnh trong khung cho phép.
            </dd>
          </div>
          <div>
            <dt>Đình chỉ</dt>
            <dd>
              <code>OWNER</code> có quyền tạm khóa (<code>DISABLED</code>) hoặc thu hồi quyền truy cập của bất kỳ thành
              viên nào vi phạm quy chế bảo mật của tổ chức.
            </dd>
          </div>
        </dl>
      </section>

      <section className="governance-v2-closing">
        <div>
          <p className="eyebrow">TUÂN THỦ & KIỂM SOÁT</p>
          <h2>Bắt đầu quy trình đấu thầu thiết bị y tế minh bạch ngay hôm nay.</h2>
        </div>
        <Link className="button enterprise-cta" href="/apply">
          Đăng ký tổ chức
        </Link>
      </section>

      <MarketingFooter />
    </main>
  )
}
