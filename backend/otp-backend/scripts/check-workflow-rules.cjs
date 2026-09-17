// Uses the signed-in Firebase CLI account to compile rules without publishing them.
const fs = require('node:fs')
const path = require('node:path')
async function main() {
  const root = path.resolve(__dirname, '../../..')
  const cli = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib')
  const { getGlobalDefaultAccount } = require(path.join(cli, 'auth.js'))
  const { requireAuth } = require(path.join(cli, 'requireAuth.js'))
  const { testRuleset } = require(path.join(cli, 'gcp/rules.js'))
  const account = getGlobalDefaultAccount()
  if (!account) throw new Error('Sign in to the Firebase CLI before compiling rules.')
  const project = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects.default
  await requireAuth({ ...account, project, nonInteractive: true })
  const response = await testRuleset(project, [{ name: 'firestore.rules', content: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') }])
  const issues = response.body?.issues || []
  for (const issue of issues) console.log(`${issue.severity}: line ${issue.sourcePosition?.line || '?'}: ${issue.description}`)
  if (issues.some((issue) => issue.severity === 'ERROR')) process.exitCode = 1
  else console.log('Firestore rules compiled successfully. No rules were deployed.')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
