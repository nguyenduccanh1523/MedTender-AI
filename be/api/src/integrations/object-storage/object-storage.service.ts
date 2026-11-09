import { Injectable, Logger } from '@nestjs/common'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

export interface StorageObjectResult {
  bucket: string
  key: string
  sizeBytes: number
  sha256: string
  stream?: NodeJS.ReadableStream
}

export type StorageProviderType = 'local' | 'supabase' | 's3' | 'r2'

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name)
  private readonly provider: StorageProviderType
  private readonly localStorageDir: string
  private readonly supabaseUrl: string | null
  private readonly supabaseKey: string | null
  private readonly s3Client: S3Client | null = null
  private readonly bucketName: string

  constructor() {
    const rawProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase() as StorageProviderType
    this.provider = ['local', 'supabase', 's3', 'r2'].includes(rawProvider) ? rawProvider : 'local'

    this.supabaseUrl =
      process.env.SUPABASE_URL || 'https://iwnfxfkcrnqdocdvdook.supabase.co'
    this.supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bmZ4Zmtjcm5xZG9jZHZkb29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDE0NTAsImV4cCI6MjEwOTM3NzQ1MH0.3umcrrlkiKoLn3ia2rKs7flXRGS4sgXUEg89INSljE8'

    // Determine target bucket name
    if (this.provider === 'r2') {
      this.bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET || 'medtender-vault'
    } else if (this.provider === 'supabase') {
      this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'medtender-vault'
    } else {
      this.bucketName = process.env.S3_BUCKET || 'medtender-vault'
    }

    if (this.provider === 'supabase') {
      this.logger.log(`Initialized Supabase Storage provider for bucket: ${this.bucketName} (${this.supabaseUrl})`)
    }

    // Configure S3 / Cloudflare R2 Client if requested
    if (this.provider === 'r2' || this.provider === 's3') {
      const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
      const accessKeyId =
        process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || ''
      const secretAccessKey =
        process.env.R2_SECRET_ACCESS_KEY ||
        process.env.AWS_SECRET_ACCESS_KEY ||
        process.env.S3_SECRET_ACCESS_KEY ||
        ''

      let endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
      if (this.provider === 'r2' && accountId && !endpoint) {
        endpoint = `https://${accountId}.r2.cloudflarestorage.com`
      }

      if (endpoint && accessKeyId && secretAccessKey) {
        this.s3Client = new S3Client({
          region: this.provider === 'r2' ? 'auto' : (process.env.AWS_REGION || 'us-east-1'),
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        })
        this.logger.log(`Initialized S3/R2 storage client (${this.provider}) with endpoint: ${endpoint}`)
      } else {
        this.logger.warn(
          `Storage provider is set to '${this.provider}', but credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are incomplete. Falling back to local storage vault.`,
        )
      }
    }

    // Local/Mount storage fallback configuration
    if (process.env.STORAGE_VAULT_DIR) {
      this.localStorageDir = path.resolve(process.env.STORAGE_VAULT_DIR)
    } else if (fs.existsSync(path.resolve(process.cwd(), 'storage_vault'))) {
      this.localStorageDir = path.resolve(process.cwd(), 'storage_vault')
    } else {
      this.localStorageDir = path.resolve(process.cwd(), '..', 'storage_vault_external')
    }

    if (!fs.existsSync(this.localStorageDir)) {
      try {
        fs.mkdirSync(this.localStorageDir, { recursive: true })
      } catch {
        this.localStorageDir = path.resolve(process.cwd(), 'storage_vault')
        if (!fs.existsSync(this.localStorageDir)) {
          fs.mkdirSync(this.localStorageDir, { recursive: true })
        }
      }
    }
  }

  getBucketName(): string {
    return this.bucketName
  }

  getProvider(): StorageProviderType {
    return this.provider
  }

  buildObjectKey(params: {
    organizationId: string
    documentId: string
    versionNumber: number
    fileAssetId: string
  }): string {
    return `org/${params.organizationId}/docs/${params.documentId}/v${params.versionNumber}/${params.fileAssetId}`
  }

  private resolveLocalPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_\-\/]/g, '_')
    const fullPath = path.join(this.localStorageDir, safeKey)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return fullPath
  }

  async putBuffer(key: string, buffer: Buffer): Promise<void> {
    // 1. Cloud Provider: Cloudflare R2 / AWS S3
    if (this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: 'application/octet-stream',
        }),
      )
      return
    }

    // 2. Cloud Provider: Supabase Storage
    if (this.provider === 'supabase') {
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase Storage configuration error: missing SUPABASE_URL or SUPABASE_KEY')
      }
      const bucket = this.getBucketName()
      const url = `${this.supabaseUrl}/storage/v1/object/${bucket}/${key}`
      this.logger.log(`[Supabase Storage] Uploading object (${buffer.length} bytes) to ${bucket}/${key}`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      })
      if (!res.ok) {
        const text = await res.text()
        this.logger.error(`[Supabase Storage] Upload failed (${res.status}): ${text}`)
        throw new Error(`Supabase Storage upload failed: ${res.status} ${text}`)
      }
      this.logger.log(`[Supabase Storage] Upload complete: ${bucket}/${key}`)
      return
    }

    // 3. Persistent Local / Mounted Volume Storage (STORAGE_VAULT_DIR)
    const fullPath = this.resolveLocalPath(key)
    await fs.promises.writeFile(fullPath, buffer)
  }

  async getBuffer(key: string): Promise<Buffer> {
    // 1. Cloud Provider: Cloudflare R2 / AWS S3
    if (this.s3Client) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      )
      if (!response.Body) {
        throw new Error(`Empty body returned from S3/R2 for object: ${key}`)
      }
      const byteArray = await response.Body.transformToByteArray()
      return Buffer.from(byteArray)
    }

    // 2. Cloud Provider: Supabase Storage
    if (this.provider === 'supabase') {
      const bucket = this.getBucketName()
      let url = `${this.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${key}`
      let res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.supabaseKey}` },
      })
      if (!res.ok) {
        url = `${this.supabaseUrl}/storage/v1/object/${bucket}/${key}`
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.supabaseKey}` },
        })
      }
      if (!res.ok) {
        throw new Error(`Supabase Storage download failed: ${res.statusText}`)
      }
      const arrayBuf = await res.arrayBuffer()
      return Buffer.from(arrayBuf)
    }

    // 3. Persistent Local / Mounted Volume Storage
    const fullPath = this.resolveLocalPath(key)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found in storage: ${key}`)
    }
    return fs.promises.readFile(fullPath)
  }

  async deleteObject(key: string): Promise<void> {
    // 1. Cloud Provider: Cloudflare R2 / AWS S3
    if (this.s3Client) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      )
      return
    }

    // 2. Cloud Provider: Supabase Storage
    if (this.provider === 'supabase') {
      const bucket = this.getBucketName()
      const url = `${this.supabaseUrl}/storage/v1/object/${bucket}`
      await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [key] }),
      })
      return
    }

    // 3. Persistent Local / Mounted Volume Storage
    const fullPath = this.resolveLocalPath(key)
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath)
    }
  }

  async exists(key: string): Promise<boolean> {
    // 1. Cloud Provider: Cloudflare R2 / AWS S3
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          }),
        )
        return true
      } catch {
        return false
      }
    }

    // 2. Cloud Provider: Supabase Storage
    if (this.provider === 'supabase') {
      try {
        await this.getBuffer(key)
        return true
      } catch {
        return false
      }
    }

    // 3. Persistent Local / Mounted Volume Storage
    const fullPath = this.resolveLocalPath(key)
    return fs.existsSync(fullPath)
  }
}
