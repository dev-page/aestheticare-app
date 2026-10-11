import fs from 'node:fs'
import assert from 'node:assert/strict'
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc'
import babelParser from '@babel/parser'

const coverage = JSON.parse(fs.readFileSync('scripts/page-skeleton-coverage.json', 'utf8'))
const components = [
  'PageSkeleton', 'OwnerPageSkeleton', 'DashboardSkeleton', 'PageSectionSkeleton',
].map(name => `frontend/src/components/common/${name}.vue`)

for (const filename of [...coverage.map(entry => entry.filename), ...components]) {
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [], `${filename}: invalid component`)
  if (coverage.some(entry => entry.filename === filename)) {
    assert.ok(source.includes('usePageLoading'), `${filename}: missing load tracking`)
    assert.ok(source.includes('v-page-loading='), `${filename}: missing skeleton boundary`)
  }
  const script = descriptor.scriptSetup ? compileScript(descriptor, { id: 'loading-check' }) : null
  if (descriptor.script) babelParser.parse(descriptor.script.content, { sourceType: 'module' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'loading-check',
    compilerOptions: { bindingMetadata: script?.bindings },
  })
  assert.deepEqual(template.errors, [], `${filename}: invalid template`)
  for (const style of descriptor.styles) {
    const compiled = compileStyle({ source: style.content, filename, id: 'loading-check', scoped: style.scoped })
    assert.deepEqual(compiled.errors, [], `${filename}: invalid styles`)
  }
}
console.log(`${coverage.length} data pages and ${components.length} shared skeleton components passed compilation checks.`)
