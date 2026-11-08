import { BadRequestException } from '@nestjs/common'
import * as crypto from 'crypto'
import {
  DataClassification,
  DocumentType,
  DocumentVersionStatus,
  FileScanStatus,
} from '../src/database/generated/client'
import { AiPoliciesService } from '../src/modules/ai-policies/ai-policies.service'
import {
  MAX_FILE_SIZE_DOCX,
  MAX_FILE_SIZE_PDF,
  MAX_FILE_SIZE_XLSX,
  validateUploadIntentInput,
} from '../src/modules/documents/documents.dto'
import { DocumentsService } from '../src/modules/documents/documents.service'

describe('Step 05 — Secure Document Upload, Policies & Malware Quarantine', () => {
  it('validates upload constraints: MIME types, file size limits and SHA-256 formatting', () => {
    // 1. Rejects unknown MIME types
    expect(() =>
      validateUploadIntentInput({
        title: 'Báo giá',
        originalFilename: 'virus.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
      }),
    ).toThrow(BadRequestException)

    // 2. Rejects files exceeding limits (PDF > 100MB, DOCX > 50MB, XLSX > 50MB)
    expect(() =>
      validateUploadIntentInput({
        title: 'Tài liệu siêu lớn',
        originalFilename: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_FILE_SIZE_PDF + 1,
        sha256: 'a'.repeat(64),
      }),
    ).toThrow(BadRequestException)

    expect(() =>
      validateUploadIntentInput({
        title: 'Word quá cỡ',
        originalFilename: 'huge.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: MAX_FILE_SIZE_DOCX + 1,
        sha256: 'a'.repeat(64),
      }),
    ).toThrow(BadRequestException)

    expect(() =>
      validateUploadIntentInput({
        title: 'Excel quá cỡ',
        originalFilename: 'huge.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: MAX_FILE_SIZE_XLSX + 1,
        sha256: 'a'.repeat(64),
      }),
    ).toThrow(BadRequestException)

    // 3. Rejects invalid SHA-256 format
    expect(() =>
      validateUploadIntentInput({
        title: 'File chuẩn',
        originalFilename: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'short-hash',
      }),
    ).toThrow(BadRequestException)

    // 4. Valid input formats correctly
    const valid = validateUploadIntentInput({
      title: '  E-HSMT Gói 01  ',
      originalFilename: '  hsmt.pdf  ',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      sha256: 'A'.repeat(64),
      classification: DataClassification.CONFIDENTIAL,
    })
    expect(valid.title).toBe('E-HSMT Gói 01')
    expect(valid.originalFilename).toBe('hsmt.pdf')
    expect(valid.sha256).toBe('a'.repeat(64))
    expect(valid.documentType).toBe(DocumentType.TENDER_DOC)
    expect(valid.classification).toBe(DataClassification.CONFIDENTIAL)
  })

  it('strictly enforces AI Data Policy: CONFIDENTIAL/RESTRICTED data is NEVER sent to external AI', () => {
    const aiService = new AiPoliciesService()

    // 1. RESTRICTED is completely blocked from external AI regardless of org setting
    const restrictedPolicy = aiService.evaluatePolicy(DataClassification.RESTRICTED, 'INTERNAL_ONLY')
    expect(restrictedPolicy.allowExternalAi).toBe(false)
    expect(restrictedPolicy.modelTier).toBe('BLOCKED')

    // 2. CONFIDENTIAL is locked to LOCAL_ONLY models
    const confidentialPolicy = aiService.evaluatePolicy(DataClassification.CONFIDENTIAL, 'INTERNAL_ONLY')
    expect(confidentialPolicy.allowExternalAi).toBe(false)
    expect(confidentialPolicy.modelTier).toBe('LOCAL_ONLY')

    // 3. When org policy is OFF, even INTERNAL data stays 100% local
    const internalPolicyOrgOff = aiService.evaluatePolicy(DataClassification.INTERNAL, 'OFF')
    expect(internalPolicyOrgOff.allowExternalAi).toBe(false)
    expect(internalPolicyOrgOff.modelTier).toBe('LOCAL_ONLY')

    // 4. When org policy allows and data is INTERNAL, external AI is permitted
    const internalPolicyAllowed = aiService.evaluatePolicy(DataClassification.INTERNAL, 'INTERNAL_ONLY')
    expect(internalPolicyAllowed.allowExternalAi).toBe(true)
    expect(internalPolicyAllowed.modelTier).toBe('PRIVATE_ISOLATED')
  })

  it('detects magic byte spoofing and quarantines malicious or disguised files during completeUpload', async () => {
    const mockStorage = {
      buildObjectKey: jest.fn().mockReturnValue('org/mock-org/docs/d-1/v1/f-1'),
      getBucketName: jest.fn().mockReturnValue('medtender-vault'),
      putBuffer: jest.fn().mockResolvedValue(undefined),
      getBuffer: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    }

    const mockTx = {
      documentVersion: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      fileAsset: {
        update: jest.fn().mockResolvedValue({}),
      },
      securityIncident: {
        create: jest.fn().mockResolvedValue({}),
      },
      tenderAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      document: {
        findFirst: jest.fn(),
      },
    }

    const mockOrgs = {
      withWorkspace: jest.fn().mockImplementation((_u, _s, fn) => fn(mockTx, 'org-a', 'OWNER')),
    }

    const docService = new DocumentsService({} as never, mockOrgs as never, mockStorage as never, {} as never)

    // Test case 1: Disguised EXE disguised as PDF (Magic Bytes MZ)
    const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00malicious-payload')
    mockStorage.getBuffer.mockResolvedValueOnce(fakePdfBuffer)

    mockTx.documentVersion.findUnique.mockResolvedValueOnce({
      id: 'v-1',
      organizationId: 'org-a',
      versionNumber: 1,
      versionLabel: 'v1',
      status: DocumentVersionStatus.DRAFT,
      document: { title: 'Báo giá độc hại' },
      fileAsset: {
        id: 'fa-1',
        organizationId: 'org-a',
        originalFilename: 'bao-gia.pdf',
        mimeType: 'application/pdf',
        sha256: crypto.createHash('sha256').update(fakePdfBuffer).digest('hex'),
        objectKey: 'vault/fake.pdf',
        sizeBytes: BigInt(fakePdfBuffer.length),
        consumedAt: null,
      },
    })

    mockTx.document.findFirst.mockResolvedValueOnce({
      id: 'doc-1',
      organizationId: 'org-a',
      title: 'Báo giá độc hại',
      documentType: DocumentType.TENDER_DOC,
      classification: DataClassification.CONFIDENTIAL,
      description: null,
      tenderId: null,
      productId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [],
    })

    await docService.completeUpload('u-1', 'bv-a', 'doc-1', 1)

    // Verify file was quarantined in DB and security incident was filed
    expect(mockTx.fileAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scanStatus: FileScanStatus.QUARANTINED,
        }),
      }),
    )
    expect(mockTx.securityIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'bao-gia.pdf',
          status: 'OPEN',
        }),
      }),
    )
    expect(mockTx.tenderAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DOCUMENT_QUARANTINED',
        }),
      }),
    )
  })
})
