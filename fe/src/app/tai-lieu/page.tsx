import Link from 'next/link'

import { MarketingFooter } from '../../features/marketing/components/marketing-footer'
import { MarketingHeader } from '../../features/marketing/components/marketing-header'

const pillars = [
  [
    'Cấu trúc Hồ sơ thầu (Tender · Lot · Item)',
    'Chuẩn hóa E-HSMT, RFQ và hồ sơ mua sắm nội bộ theo đúng phân cấp Gói thầu → Phân lô (Lot) → Dòng thiết bị (Item) kèm nhật ký kiểm toán.',
  ],
  [
    'Catalog & Phiên bản bất biến (v1 · v2)',
    'Quản lý SKU thiết bị y tế theo lịch sử phiên bản bất biến có mã băm SHA-256 và cảnh báo tự động khi thông số xung đột giữa các nguồn tài liệu.',
  ],
  [
    'Phân quyền RBAC 7 vai trò & Đa tổ chức',
    'Một tài khoản cá nhân độc lập có thể tham gia nhiều tổ chức với vai trò khác nhau (OWNER, ADMIN, BID_MANAGER, CATALOG_MANAGER, ANALYST, REVIEWER, VIEWER).',
  ],
]

const workflowSteps = [
  {
    number: '01',
    title: 'Khởi tạo Tổ chức & Cấu hình Tuân thủ',
    detail:
      'System Admin phê duyệt pháp nhân. OWNER thiết lập mức phân loại dữ liệu (INTERNAL, CONFIDENTIAL, RESTRICTED), chính sách AI và nguyên tắc 4 mắt.',
  },
  {
    number: '02',
    title: 'Chuẩn hóa Danh mục Thiết bị (Catalog)',
    detail:
      'CATALOG_MANAGER nhập thông số kỹ thuật kèm nguồn trích dẫn (Brochure, IFU, CFS), xử lý xung đột nguồn và xuất bản phiên bản khóa bất biến.',
  },
  {
    number: '03',
    title: 'Lập Hồ sơ thầu & Thẩm định Độc lập',
    detail:
      'BID_MANAGER và ANALYST lập cấu trúc Lot/Item và chạy đối chiếu bằng chứng; REVIEWER độc lập kiểm tra chéo trước khi phê duyệt xuất báo cáo.',
  },
]

export default function DocumentationPage() {
  return (
    <main className="enterprise-page platform-page governance-v2">
      <MarketingHeader />

      <section className="platform-hero">
        <div>
          <p className="eyebrow">TÀI LIỆU HƯỚNG DẪN & KIẾN TRÚC HỆ THỐNG</p>
          <h1>Mọi quy tắc vận hành đều minh bạch và kiểm chứng được.</h1>
          <p>
            Tài liệu chính thức giúp đội ngũ bệnh viện, nhà thầu thiết bị y tế và bộ phận kiểm toán nắm vững mô hình dữ
            liệu, cơ chế phiên bản bất biến và phân quyền đa tổ chức trên MedTender AI.
          </p>
          <div className="marketing-actions">
            <Link className="button enterprise-cta" href="/apply">
              Đăng ký tổ chức
            </Link>
            <Link className="marketing-text-link" href="/quan-tri">
              Xem mô hình quản trị →
            </Link>
          </div>
        </div>
        <aside className="platform-structure" aria-label="Kiến trúc bảo chứng dữ liệu">
          <p>KIẾN TRÚC BẢO CHỨNG</p>
          <strong>Tenant Isolation</strong>
          <i />
          <strong>Immutable Version</strong>
          <i />
          <strong>Source Citation</strong>
          <i />
          <strong>Independent Review</strong>
          <span>Cô lập dữ liệu · Khóa SHA-256 · Truy vết nguồn</span>
        </aside>
      </section>

      <section className="platform-foundations" aria-label="Ba trụ cột kiến trúc">
        {pillars.map(([title, copy], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="platform-evidence" aria-label="Giải đáp kiến trúc phiên làm việc và phân quyền">
        <div>
          <p className="eyebrow">CƠ CHẾ TÀI KHOẢN & PHIÊN ĐĂNG NHẬP</p>
          <h2>Một tài khoản cá nhân độc lập, làm việc xuyên suốt nhiều tổ chức.</h2>
          <p>
            Hệ thống tách biệt hoàn toàn giữa Định danh cá nhân (User Identity) và Quyền hạn tại từng tổ chức
            (Organization Membership) để đảm bảo tính linh hoạt và bảo mật cao nhất.
          </p>
        </div>
        <dl>
          <div>
            <dt>Phiên làm việc</dt>
            <dd>
              Duy trì bằng Cookie <code>HttpOnly</code> + Refresh Token xoay vòng. Chuyển từ Workspace ra trang chủ hoặc
              trang Tài liệu không làm mất phiên đăng nhập.
            </dd>
          </div>
          <div>
            <dt>Đa vai trò</dt>
            <dd>
              Vai trò không gắn cứng vào tài khoản. Bạn có thể là <strong>REVIEWER</strong> tại Bệnh viện A và đồng thời
              là <strong>ADMIN / OWNER</strong> tại Công ty B.
            </dd>
          </div>
          <div>
            <dt>Khóa phiên bản</dt>
            <dd>
              Khi xuất bản <code>v2</code> trong Catalog, phiên bản <code>v1</code> chuyển sang trạng thái{' '}
              <code>SUPERSEDED</code> và giữ nguyên toàn bộ thông số lịch sử.
            </dd>
          </div>
          <div>
            <dt>Kiểm toán</dt>
            <dd>
              Mọi thao tác tạo/sửa/xóa Lot, Item, xuất bản Catalog và đổi chính sách đều lưu vết vào bảng Audit Log của
              tổ chức.
            </dd>
          </div>
        </dl>
      </section>

      <section className="governance-v2-process" aria-labelledby="doc-workflow-heading">
        <div className="governance-v2-section-head">
          <p className="eyebrow">QUY TRÌNH TRIỂN KHAI CHUẨN</p>
          <h2 id="doc-workflow-heading">Ba bước vận hành từ lúc mở Workspace đến khi xuất báo cáo.</h2>
          <p>Thiết kế chuyên biệt cho quy trình đấu thầu và mua sắm trang thiết bị y tế tại Việt Nam.</p>
        </div>
        <ol>
          {workflowSteps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="governance-v2-closing">
        <div>
          <p className="eyebrow">BẮT ĐẦU VẬN HÀNH</p>
          <h2>Khởi tạo không gian làm việc có kiểm soát cho đơn vị của bạn.</h2>
        </div>
        <Link className="button enterprise-cta" href="/apply">
          Đăng ký tổ chức
        </Link>
      </section>

      <MarketingFooter />
    </main>
  )
}
