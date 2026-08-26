export function normalizeEmail(input: string) {
  if (!input) return ''
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
}
