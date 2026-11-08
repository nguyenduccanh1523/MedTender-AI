import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import * as crypto from 'crypto'
import { DatabaseService } from '../../database/database.service'
import {
  DataClassification,
  DocumentVersionStatus,
  FileScanStatus,
  MembershipRole,
  Prisma,
} from '../../database/generated/client'
import { ObjectStorageService } from '../../integrations/object-storage/object-storage.service'
import { AiPoliciesService } from '../ai-policies/ai-policies.service'
import { LEGAL_NOTICES } from '../legal-notices/legal-notices.config'
import { OrganizationsService } from '../organizations/application/organizations.service'
import {
  AcceptPolicyConsentDto,
  CompleteUploadDto,
  DocumentDetailDto,
  DownloadLinkResponseDto,
  PolicyConsentStatusDto,
  RequestUploadIntentDto,
  SecurityIncidentSummaryDto,
  UploadIntentResponseDto,
  validateUploadIntentInput,
} from './documents.dto'

const uploadRoles = new Set<MembershipRole>(['OWNER', 'ADMIN', 'BID_MANAGER', 'CATALOG_MANAGER'])

@Injectable()
export class DocumentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly organizations: OrganizationsService,
    private readonly storage: ObjectStorageService,
    private readonly aiPolicies: AiPoliciesService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  async getPolicyConsentStatus(userId: string, slug: string): Promise<PolicyConsentStatusDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const consent = await tx.userPolicyConsent.findUnique({
        where: {
          organizationId_userId_policyVersion: {
            organizationId,
            userId,
            policyVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          },
        },
      })

      return {
        hasConsented: Boolean(consent && consent.termsAccepted && consent.privacyAccepted),
        currentPolicyVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
        acceptedAt: consent ? consent.acceptedAt : null,
        termsTitle: LEGAL_NOTICES.TERMS_TITLE,
        termsSummary: LEGAL_NOTICES.TERMS_SUMMARY,
        privacyTitle: LEGAL_NOTICES.PRIVACY_TITLE,
        privacySummary: LEGAL_NOTICES.PRIVACY_SUMMARY,
        aiNoticeTitle: LEGAL_NOTICES.AI_NOTICE_TITLE,
        aiNoticeSummary: LEGAL_NOTICES.AI_NOTICE_SUMMARY,
      }
    })
  }

  async acceptPolicyConsent(
    userId: string,
    slug: string,
    body: AcceptPolicyConsentDto,
  ): Promise<PolicyConsentStatusDto> {
    if (!body.termsAccepted || !body.privacyAccepted || !body.aiNoticeAccepted) {
      throw new BadRequestException('Bạn cần đồng ý với các điều khoản và chính sách để tiếp tục.')
    }

    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const consent = await tx.userPolicyConsent.upsert({
        where: {
          organizationId_userId_policyVersion: {
            organizationId,
            userId,
            policyVersion: body.policyVersion || LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          },
        },
        create: {
          organizationId,
          userId,
          policyVersion: body.policyVersion || LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          termsAccepted: true,
          privacyAccepted: true,
          aiNoticeAccepted: true,
        },
        update: {
          termsAccepted: true,
          privacyAccepted: true,
          aiNoticeAccepted: true,
          acceptedAt: new Date(),
        },
      })

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'POLICY_CONSENT_ACCEPTED',
          summary: `Xác nhận bộ chính sách dữ liệu và pháp lý phiên bản ${consent.policyVersion}`,
          details: { policyVersion: consent.policyVersion },
        },
      })

      return this.getPolicyConsentStatus(userId, slug)
    })
  }

  async createUploadIntent(
    userId: string,
    slug: string,
    body: RequestUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    const input = validateUploadIntentInput(body)

    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (!uploadRoles.has(role)) {
        throw new ForbiddenException('Bạn không có quyền tải tài liệu lên tổ chức này.')
      }

      // Check user policy consent
      const consent = await tx.userPolicyConsent.findUnique({
        where: {
          organizationId_userId_policyVersion: {
            organizationId,
            userId,
            policyVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          },
        },
      })
      if (!consent) {
        throw new ForbiddenException(
          'Bạn cần xác nhận Chính sách dữ liệu & Pháp lý trước khi tải tệp lần đầu.',
        )
      }

      // Verify tender or product exists if specified
      if (input.tenderId) {
        const tender = await tx.tender.findFirst({
          where: { id: input.tenderId, organizationId },
        })
        if (!tender) throw new NotFoundException('Hồ sơ thầu liên kết không tồn tại.')
      }
      if (input.productId) {
        const product = await tx.product.findFirst({
          where: { id: input.productId, organizationId },
        })
        if (!product) throw new NotFoundException('Sản phẩm Catalog liên kết không tồn tại.')
      }

      // Find or create logical Document
      let documentId = input.documentId
      let versionNumber = 1

      if (documentId) {
        const existingDoc = await tx.document.findFirst({
          where: { id: documentId, organizationId },
          include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
        })
        if (!existingDoc) throw new NotFoundException('Tài liệu chỉ định không tồn tại.')
        versionNumber = (existingDoc.versions[0]?.versionNumber ?? 0) + 1
      } else {
        const doc = await tx.document.create({
          data: {
            organizationId,
            title: input.title,
            documentType: input.documentType,
            classification: input.classification,
            description: input.notes,
            tenderId: input.tenderId,
            productId: input.productId,
            createdByUserId: userId,
          },
        })
        documentId = doc.id
      }

      const fileAssetId = crypto.randomUUID()
      const uploadToken = crypto.randomBytes(32).toString('hex')
      const uploadTokenHash = this.hashToken(uploadToken)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes TTL

      const objectKey = this.storage.buildObjectKey({
        organizationId,
        documentId,
        versionNumber,
        fileAssetId,
      })

      await tx.fileAsset.create({
        data: {
          id: fileAssetId,
          organizationId,
          bucket: this.storage.getBucketName(),
          objectKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: BigInt(input.sizeBytes),
          sha256: input.sha256,
          scanStatus: FileScanStatus.PENDING,
          uploadTokenHash,
          expiresAt,
          createdByUserId: userId,
        },
      })

      const versionLabel = `v${versionNumber}`
      await tx.documentVersion.create({
        data: {
          organizationId,
          documentId,
          versionNumber,
          versionLabel,
          fileAssetId,
          status: DocumentVersionStatus.DRAFT,
          rightsConfirmed: true,
          rightsConfirmedAt: new Date(),
          acceptedTermsVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          acceptedPrivacyVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          acceptedAiNoticeVersion: LEGAL_NOTICES.CURRENT_POLICY_VERSION,
          notes: input.notes,
          createdByUserId: userId,
        },
      })

      return {
        intentId: fileAssetId,
        uploadToken,
        uploadUrl: `/api/v1/organizations/${slug}/documents/upload-stream/${fileAssetId}?token=${uploadToken}`,
        expiresAt,
        documentId,
        versionNumber,
        versionLabel,
        maxSizeBytes: Number(input.sizeBytes),
      }
    })
  }

  async uploadStream(
    userId: string,
    slug: string,
    intentId: string,
    token: string,
    buffer: Buffer,
  ): Promise<{ success: boolean; sha256: string }> {
    console.log(
      `[DocumentsService.uploadStream] Received upload request: userId="${userId}", slug="${slug}", intentId="${intentId}", tokenLength=${token ? token.length : 0}, bufferBytes=${buffer ? buffer.length : 0}`,
    )

    if (!token) {
      console.error(`[DocumentsService.uploadStream] Missing upload token for intentId: ${intentId}`)
      throw new ForbiddenException('Thiếu token xác thực upload.')
    }

    const tokenHash = this.hashToken(token)

    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'BID_MANAGER' && role !== 'CATALOG_MANAGER') {
        throw new ForbiddenException('Bạn không có quyền tải lên tài liệu trong tổ chức này.')
      }

      const asset = await tx.fileAsset.findUnique({
        where: { id: intentId },
        include: { organization: true },
      })

      if (!asset) {
        console.error(
          `[DocumentsService.uploadStream] Asset not found for intentId: ${intentId} in organizationId: ${organizationId}`,
        )
        throw new NotFoundException('Yêu cầu tải lên không tồn tại hoặc đã bị hủy.')
      }

      if (asset.organizationId !== organizationId) {
        console.error(
          `[DocumentsService.uploadStream] Organization mismatch: asset belongs to "${asset.organizationId}", session has "${organizationId}"`,
        )
        throw new ForbiddenException('Tài liệu không thuộc tổ chức hiện tại.')
      }

      if (asset.uploadTokenHash !== tokenHash) {
        console.error(
          `[DocumentsService.uploadStream] Token hash mismatch for asset ${intentId}! Provided token hash "${tokenHash}" !== asset token hash "${asset.uploadTokenHash}"`,
        )
        throw new ForbiddenException('Token upload không hợp lệ hoặc đã hết hạn.')
      }

      if (asset.consumedAt) {
        console.error(`[DocumentsService.uploadStream] Asset ${intentId} was already consumed at: ${asset.consumedAt.toISOString()}`)
        throw new ConflictException('Token upload này đã được sử dụng (chỉ dùng 1 lần).')
      }

      if (new Date() > asset.expiresAt) {
        console.error(
          `[DocumentsService.uploadStream] Asset ${intentId} upload window expired at ${asset.expiresAt.toISOString()}, now is ${new Date().toISOString()}`,
        )
        throw new ForbiddenException('Thời hạn tải tệp lên đã hết hạn (10 phút).')
      }

      // Verify byte size matches declared size
      if (BigInt(buffer.length) !== asset.sizeBytes) {
        console.error(
          `[DocumentsService.uploadStream] Byte size mismatch: uploaded ${buffer.length} bytes, declared ${asset.sizeBytes} bytes`,
        )
        throw new BadRequestException(
          `Kích thước tệp tải lên (${buffer.length} bytes) không khớp với khai báo (${asset.sizeBytes} bytes).`,
        )
      }

      // Verify SHA-256 matches declared hash
      const computedSha = crypto.createHash('sha256').update(buffer).digest('hex')
      if (computedSha.toLowerCase() !== asset.sha256.toLowerCase()) {
        console.error(
          `[DocumentsService.uploadStream] SHA-256 hash mismatch! Computed: "${computedSha}", Declared: "${asset.sha256}"`,
        )
        throw new BadRequestException(
          'Mã băm SHA-256 của tệp không khớp với khai báo ban đầu. Tệp có thể đã bị thay đổi.',
        )
      }

      // Write to storage vault
      await this.storage.putBuffer(asset.objectKey, buffer)
      console.log(`[DocumentsService.uploadStream] Successfully wrote ${buffer.length} bytes to vault object: ${asset.objectKey}`)
      return { success: true, sha256: computedSha }
    })
  }

  async completeUpload(
    userId: string,
    slug: string,
    documentId: string,
    versionNumber: number,
    _body?: CompleteUploadDto,
    clientIp?: string,
  ): Promise<DocumentDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const docVersion = await tx.documentVersion.findUnique({
        where: {
          documentId_versionNumber: { documentId, versionNumber },
        },
        include: {
          document: true,
          fileAsset: true,
        },
      })

      if (!docVersion || docVersion.organizationId !== organizationId) {
        throw new NotFoundException('Phiên bản tài liệu không tồn tại.')
      }

      const asset = docVersion.fileAsset
      if (asset.consumedAt && docVersion.status === DocumentVersionStatus.READY) {
        // Idempotent return
        return this.getDocumentDetail(userId, slug, documentId)
      }

      // Check if file exists in storage
      const exists = await this.storage.exists(asset.objectKey)
      if (!exists) {
        throw new BadRequestException(
          'Chưa nhận được dữ liệu tệp trong kho lưu trữ. Vui lòng tải dữ liệu trước khi hoàn tất.',
        )
      }

      // Mark upload token consumed
      await tx.fileAsset.update({
        where: { id: asset.id },
        data: { consumedAt: new Date(), scanStatus: FileScanStatus.SCANNING },
      })

      // Security Inspection: Verify Magic Bytes
      const buffer = await this.storage.getBuffer(asset.objectKey)
      const headerStr = buffer.slice(0, 16).toString('binary')
      let isQuarantined = false
      let quarantineReason = ''

      if (asset.mimeType === 'application/pdf') {
        if (!headerStr.startsWith('%PDF-')) {
          isQuarantined = true
          quarantineReason =
            'Giả mạo định dạng: khai báo application/pdf nhưng nội dung không có magic bytes chuẩn (%PDF-).'
        }
      } else if (
        asset.mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        asset.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        // ZIP magic bytes: PK\x03\x04
        if (!headerStr.startsWith('PK\x03\x04')) {
          isQuarantined = true
          quarantineReason =
            'Giả mạo định dạng: tệp Office OpenXML thiếu chữ ký tệp nén PKZip chuẩn.'
        }
      }

      // Check for DOS MZ executable header (Trojan/exe renamed to pdf)
      if (headerStr.startsWith('MZ')) {
        isQuarantined = true
        quarantineReason =
          'Phát hiện tệp thực thi Windows (chữ ký MZ) được đổi đuôi thành tài liệu.'
      }

      if (isQuarantined) {
        // QUARANTINE FILE
        await tx.fileAsset.update({
          where: { id: asset.id },
          data: {
            scanStatus: FileScanStatus.QUARANTINED,
            quarantineReason,
          },
        })

        const incidentRef = `INC-${Date.now().toString().slice(-4)}`
        await tx.securityIncident.create({
          data: {
            organizationId,
            reference: incidentRef,
            fileAssetId: asset.id,
            fileName: asset.originalFilename,
            sha256: asset.sha256,
            reason: quarantineReason,
            status: 'OPEN',
            ipAddress: clientIp ?? '127.0.0.1',
            uploadedByUserId: userId,
          },
        })

        await tx.tenderAuditLog.create({
          data: {
            organizationId,
            actorUserId: userId,
            actorRole: role,
            action: 'DOCUMENT_QUARANTINED',
            summary: `CÁCH LY BẢO MẬT: Tệp "${asset.originalFilename}" (${incidentRef}) do vi phạm cấu trúc tệp an toàn`,
            details: {
              reference: incidentRef,
              fileAssetId: asset.id,
              reason: quarantineReason,
              sha256: asset.sha256,
            },
          },
        })
      } else {
        // FILE IS CLEAN
        await tx.fileAsset.update({
          where: { id: asset.id },
          data: { scanStatus: FileScanStatus.CLEAN },
        })
        await tx.documentVersion.update({
          where: { id: docVersion.id },
          data: { status: DocumentVersionStatus.READY },
        })

        await tx.tenderAuditLog.create({
          data: {
            organizationId,
            actorUserId: userId,
            actorRole: role,
            action: 'DOCUMENT_VERSION_CREATED',
            summary: `Hoàn tất kiểm tra an toàn và tạo phiên bản ${docVersion.versionLabel} cho tài liệu "${docVersion.document.title}"`,
            details: {
              documentId,
              versionNumber,
              sha256: asset.sha256,
              sizeBytes: Number(asset.sizeBytes),
            },
          },
        })
      }

      return this.getDocumentDetail(userId, slug, documentId)
    })
  }

  async listDocuments(
    userId: string,
    slug: string,
    options?: { tenderId?: string; productId?: string },
  ): Promise<DocumentDetailDto[]> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const isViewer = role === 'VIEWER'

      const where: Prisma.DocumentWhereInput = { organizationId }
      if (options?.tenderId) where.tenderId = options.tenderId
      if (options?.productId) where.productId = options.productId
      if (isViewer) {
        where.classification = { not: DataClassification.RESTRICTED }
      }

      const docs = await tx.document.findMany({
        where,
        include: {
          tender: { select: { id: true, title: true, reference: true } },
          product: { select: { id: true, name: true, sku: true } },
          versions: {
            include: { fileAsset: true },
            orderBy: { versionNumber: 'desc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })

      return docs
        .map((doc) => {
          const visibleVersions = isViewer
            ? doc.versions.filter(
                (v) =>
                  v.fileAsset.scanStatus === FileScanStatus.CLEAN &&
                  v.status === DocumentVersionStatus.READY,
              )
            : doc.versions

          if (isViewer && visibleVersions.length === 0) return null

          const mappedVersions = visibleVersions.map((v) => ({
            id: v.id,
            versionNumber: v.versionNumber,
            versionLabel: v.versionLabel,
            status: v.status,
            originalFilename: v.fileAsset.originalFilename,
            sizeBytes: Number(v.fileAsset.sizeBytes),
            mimeType: v.fileAsset.mimeType,
            sha256: v.fileAsset.sha256,
            scanStatus: v.fileAsset.scanStatus,
            quarantineReason: role === 'OWNER' ? v.fileAsset.quarantineReason : null,
            rightsConfirmed: v.rightsConfirmed,
            rightsConfirmedAt: v.rightsConfirmedAt,
            acceptedPolicyVersion: v.acceptedTermsVersion,
            notes: v.notes,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
          }))

          const result: DocumentDetailDto = {
            id: doc.id,
            organizationId: doc.organizationId,
            title: doc.title,
            documentType: doc.documentType,
            classification: doc.classification,
            description: doc.description,
            tenderId: doc.tenderId,
            productId: doc.productId,
            tender: doc.tender ?? null,
            product: doc.product ?? null,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            versionCount: mappedVersions.length,
            latestVersion: mappedVersions[0] ?? null,
            versions: mappedVersions,
          }
          return result
        })
        .filter((d): d is DocumentDetailDto => d !== null)
    })
  }

  async getDocumentDetail(
    userId: string,
    slug: string,
    documentId: string,
  ): Promise<DocumentDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, organizationId },
        include: {
          tender: { select: { id: true, title: true, reference: true } },
          product: { select: { id: true, name: true, sku: true } },
          versions: {
            include: { fileAsset: true },
            orderBy: { versionNumber: 'desc' },
          },
        },
      })
      if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')

      const isViewer = role === 'VIEWER'
      if (isViewer && doc.classification === DataClassification.RESTRICTED) {
        throw new ForbiddenException('Bạn không có quyền truy cập tài liệu tuyệt mật này.')
      }

      const visibleVersions = isViewer
        ? doc.versions.filter(
            (v) =>
              v.fileAsset.scanStatus === FileScanStatus.CLEAN &&
              v.status === DocumentVersionStatus.READY,
          )
        : doc.versions

      const mappedVersions = visibleVersions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        versionLabel: v.versionLabel,
        status: v.status,
        originalFilename: v.fileAsset.originalFilename,
        sizeBytes: Number(v.fileAsset.sizeBytes),
        mimeType: v.fileAsset.mimeType,
        sha256: v.fileAsset.sha256,
        scanStatus: v.fileAsset.scanStatus,
        quarantineReason: role === 'OWNER' ? v.fileAsset.quarantineReason : null,
        rightsConfirmed: v.rightsConfirmed,
        rightsConfirmedAt: v.rightsConfirmedAt,
        acceptedPolicyVersion: v.acceptedTermsVersion,
        notes: v.notes,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))

      return {
        id: doc.id,
        organizationId: doc.organizationId,
        title: doc.title,
        documentType: doc.documentType,
        classification: doc.classification,
        description: doc.description,
        tenderId: doc.tenderId,
        productId: doc.productId,
        tender: doc.tender ?? null,
        product: doc.product ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        versionCount: mappedVersions.length,
        latestVersion: mappedVersions[0] ?? null,
        versions: mappedVersions,
      }
    })
  }

  async deleteDocument(
    userId: string,
    slug: string,
    documentId: string,
  ): Promise<{ success: boolean }> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (!uploadRoles.has(role)) {
        throw new ForbiddenException('Bạn không có quyền xóa tài liệu này.')
      }

      const doc = await tx.document.findFirst({
        where: { id: documentId, organizationId },
        include: { versions: { include: { fileAsset: true } } },
      })

      if (!doc) throw new NotFoundException('Không tìm thấy tài liệu cần xóa.')

      for (const version of doc.versions) {
        try {
          await this.storage.deleteObject(version.fileAsset.objectKey)
        } catch {}
      }

      await tx.documentVersion.deleteMany({ where: { documentId } })
      await tx.document.delete({ where: { id: documentId } })

      // Clean up orphaned file assets
      for (const version of doc.versions) {
        try {
          await tx.fileAsset.delete({ where: { id: version.fileAsset.id } })
        } catch {}
      }

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'DOCUMENT_DELETED',
          summary: `Đã xóa tài liệu "${doc.title}" khỏi kho lưu trữ`,
          details: { documentId, title: doc.title },
        },
      })

      return { success: true }
    })
  }

  async getDownloadLink(
    userId: string,
    slug: string,
    documentId: string,
    versionId: string,
  ): Promise<DownloadLinkResponseDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const version = await tx.documentVersion.findFirst({
        where: { id: versionId, documentId, organizationId },
        include: { document: true, fileAsset: true },
      })
      if (!version) throw new NotFoundException('Phiên bản tài liệu không tồn tại.')

      if (version.fileAsset.scanStatus === FileScanStatus.QUARANTINED) {
        throw new ForbiddenException(
          'Tài liệu này đã bị cách ly bảo mật và bị khóa tải hoàn toàn.',
        )
      }
      if (version.fileAsset.scanStatus !== FileScanStatus.CLEAN) {
        throw new BadRequestException('Tài liệu đang trong tiến trình kiểm tra an toàn.')
      }

      if (role === 'VIEWER' && version.document.classification === DataClassification.RESTRICTED) {
        throw new ForbiddenException('Bạn không có quyền tải tài liệu tuyệt mật này.')
      }

      const downloadToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = this.hashToken(downloadToken)
      const expiresInSeconds = 120 // 2 minutes signed link
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

      // Store download intent on fileAsset temporary download token
      await tx.fileAsset.update({
        where: { id: version.fileAsset.id },
        data: { uploadTokenHash: tokenHash, expiresAt },
      })

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'DOCUMENT_DOWNLOADED',
          summary: `Cấp link tải dùng 1 lần cho tài liệu "${version.document.title}" (${version.versionLabel})`,
          details: {
            documentId,
            versionId,
            sha256: version.fileAsset.sha256,
            expiresInSeconds,
          },
        },
      })

      return {
        downloadUrl: `/api/v1/organizations/${slug}/documents/download-stream/${version.fileAsset.id}?token=${downloadToken}`,
        expiresAt,
        expiresInSeconds,
        fileName: version.fileAsset.originalFilename,
      }
    })
  }

  async getDownloadStream(
    slug: string,
    fileAssetId: string,
    token: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const tokenHash = this.hashToken(token)

    const asset = await this.database.db.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        uploadTokenHash: tokenHash,
        organization: { slug },
      },
    })

    if (!asset) {
      throw new ForbiddenException('Liên kết tải tài liệu không hợp lệ hoặc đã được sử dụng.')
    }
    if (new Date() > asset.expiresAt) {
      throw new ForbiddenException('Liên kết tải tài liệu đã hết hạn (120 giây).')
    }
    if (asset.scanStatus !== FileScanStatus.CLEAN) {
      throw new ForbiddenException('Tài liệu chưa được kiểm định an toàn hoặc đã bị cách ly.')
    }

    // Invalidate token (Single-use download)
    await this.database.db.fileAsset.update({
      where: { id: asset.id },
      data: {
        expiresAt: new Date(0),
        uploadTokenHash: `consumed_${crypto.randomBytes(16).toString('hex')}`,
      },
    })

    const buffer = await this.storage.getBuffer(asset.objectKey)
    return {
      buffer,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
    }
  }

  async listSecurityIncidents(
    userId: string,
    slug: string,
  ): Promise<SecurityIncidentSummaryDto[]> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER') {
        throw new ForbiddenException(
          'Chỉ Chủ sở hữu (OWNER) mới có quyền truy cập danh sách sự cố an toàn thông tin.',
        )
      }

      const incidents = await tx.securityIncident.findMany({
        where: { organizationId },
        include: {
          uploadedBy: { select: { displayName: true } },
          resolvedBy: { select: { displayName: true } },
          purgedBy: { select: { displayName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })

      return incidents.map((inc) => ({
        id: inc.id,
        reference: inc.reference,
        fileName: inc.fileName,
        sha256: inc.sha256,
        reason: inc.reason,
        status: inc.status,
        ipAddress: inc.ipAddress,
        uploadedByUserName: inc.uploadedBy.displayName,
        uploadedAt: inc.createdAt,
        resolvedByUserName: inc.resolvedBy?.displayName ?? null,
        resolvedAt: inc.resolvedAt,
        purgedByUserName: inc.purgedBy?.displayName ?? null,
        purgedAt: inc.purgedAt,
      }))
    })
  }

  async purgeSecurityIncident(
    userId: string,
    slug: string,
    incidentId: string,
    reason: string,
  ): Promise<{ success: boolean }> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Bắt buộc nhập lý do xóa vĩnh viễn tệp độc hại.')
    }

    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER') {
        throw new ForbiddenException('Chỉ OWNER mới có quyền xóa vĩnh viễn tệp cách ly.')
      }

      const incident = await tx.securityIncident.findFirst({
        where: { id: incidentId, organizationId },
        include: { fileAsset: true },
      })
      if (!incident) throw new NotFoundException('Không tìm thấy sự cố bảo mật.')

      // Delete binary from vault
      await this.storage.deleteObject(incident.fileAsset.objectKey)

      await tx.securityIncident.update({
        where: { id: incident.id },
        data: {
          status: 'PURGED',
          purgeReason: reason.trim(),
          purgedByUserId: userId,
          purgedAt: new Date(),
        },
      })

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'DOCUMENT_PURGED',
          summary: `Xóa vĩnh viễn tệp độc hại (${incident.reference} · ${incident.fileName}) khỏi kho lưu trữ`,
          details: {
            incidentId,
            reference: incident.reference,
            reason: reason.trim(),
            sha256: incident.sha256,
          },
        },
      })

      return { success: true }
    })
  }
}
