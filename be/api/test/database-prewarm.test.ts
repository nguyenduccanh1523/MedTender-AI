const query = jest.fn()
const disconnect = jest.fn()
const createPrismaClient = jest.fn(() => ({ $queryRawUnsafe: query, $disconnect: disconnect }))

jest.mock('../src/database/prisma-client', () => ({ createPrismaClient }))

import { DatabaseService } from '../src/database/database.service'

describe('DatabaseService prewarm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('opens the existing pool without surfacing a transient connection failure', async () => {
    query.mockRejectedValueOnce(new Error('temporary connection failure'))
    await expect(new DatabaseService().prewarm()).resolves.toBeUndefined()
  })
})
