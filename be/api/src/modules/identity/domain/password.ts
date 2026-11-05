import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
const keyLength = 64

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const parts = stored?.split(':')
  const valid = parts?.length === 2 && /^[a-f0-9]{32}$/.test(parts[0]) && /^[a-f0-9]{128}$/.test(parts[1])
  const salt = valid ? Buffer.from(parts[0], 'hex') : Buffer.alloc(16)
  const expected = valid ? Buffer.from(parts[1], 'hex') : Buffer.alloc(keyLength)
  const matches = timingSafeEqual(await derive(password, salt), expected)
  return Boolean(valid && matches)
}
