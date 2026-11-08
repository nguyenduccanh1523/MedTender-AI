import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

export interface StorageObjectResult {
  bucket: string
  key: string
  sizeBytes: number
  sha256: string
  stream?: NodeJS.ReadableStream
}

@Injectable()
export class ObjectStorageService {
  private readonly localStorageDir: string

  constructor() {
    this.localStorageDir = path.resolve(process.cwd(), 'storage_vault')
    if (!fs.existsSync(this.localStorageDir)) {
      fs.mkdirSync(this.localStorageDir, { recursive: true })
    }
  }

  getBucketName(): string {
    return process.env.S3_BUCKET ?? 'medtender-vault'
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
    const fullPath = this.resolveLocalPath(key)
    await fs.promises.writeFile(fullPath, buffer)
  }

  async getBuffer(key: string): Promise<Buffer> {
    const fullPath = this.resolveLocalPath(key)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found in storage: ${key}`)
    }
    return fs.promises.readFile(fullPath)
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolveLocalPath(key)
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath)
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolveLocalPath(key)
    return fs.existsSync(fullPath)
  }
}
