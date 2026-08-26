import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string) {
  if (bcrypt.truncates(password)) {
    throw new Error('Password exceeds bcrypt 72-byte limit')
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(data: { hash: string; password: string }) {
  return bcrypt.compare(data.password, data.hash)
}
