import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = path.join(root, 'src')
const forbidden = [
  'api.openai.com',
  'api.x.ai',
  'api.anthropic.com',
  'dashscope.aliyuncs.com',
  'api.cursor.com',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DASHSCOPE_API_KEY',
  'CURSOR_API_KEY',
]

const sourceFiles = new Bun.Glob('**/*.{ts,tsx}').scan({ cwd: sourceRoot, absolute: true })
const wranglerPath = path.join(root, 'wrangler.jsonc')
const targets = [wranglerPath]
for await (const file of sourceFiles) targets.push(file)

const findings: string[] = []
for (const file of targets) {
  const text = await Bun.file(file).text()
  for (const marker of forbidden) {
    if (text.includes(marker)) findings.push(`${file}: ${marker}`)
  }
}

const wrangler = JSON.parse(await Bun.file(wranglerPath).text()) as {
  ai?: { binding?: string }
  vars?: Record<string, string>
}
if (wrangler.ai?.binding !== 'AI') findings.push('wrangler.jsonc: Workers AI binding is missing')
if (wrangler.vars?.DIRECT_PROVIDER_API_EXECUTION !== 'disabled') {
  findings.push('wrangler.jsonc: direct provider API execution is not disabled')
}
if (wrangler.vars?.SUBSCRIPTION_EXECUTION_MODE !== 'subscription-workers') {
  findings.push('wrangler.jsonc: subscription worker execution is not active')
}

if (findings.length > 0) {
  console.error(findings.join('\n'))
  process.exit(1)
}

console.log(
  JSON.stringify({
    ok: true,
    workersAiBinding: 'AI',
    directProviderApiExecution: false,
    subscriptionWorkers: 6,
  }),
)
