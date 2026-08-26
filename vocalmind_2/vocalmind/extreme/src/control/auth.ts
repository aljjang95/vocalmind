import type { SubscriptionWorkerId } from './provider-pool'

const encoder = new TextEncoder()

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)])
  let difference = 0
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index]
  }
  return difference === 0
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

export async function verifyAdminCredential(
  authorization: string | undefined,
  expected: string | undefined,
): Promise<boolean> {
  const actual = bearerToken(authorization)
  if (!actual || !expected) return false
  return secureEqual(actual, expected)
}

export async function verifyWorkerCredential(
  workerId: SubscriptionWorkerId,
  authorization: string | undefined,
  serializedKeys: string | undefined,
): Promise<boolean> {
  const actual = bearerToken(authorization)
  if (!actual || !serializedKeys) return false

  try {
    const parsed = JSON.parse(serializedKeys) as Record<string, unknown>
    const expected = parsed[workerId]
    if (typeof expected !== 'string' || expected.length < 16) return false
    return secureEqual(actual, expected)
  } catch {
    return false
  }
}

export async function hashLeaseToken(token: string): Promise<string> {
  const hash = await sha256(token)
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
