<template>
  <article class="client-agreement" :style="documentStyle">
    <header class="agreement-brand">
      <h2>{{ document.title }}</h2>
      <p>{{ document.intro }}</p>
    </header>
    <section v-for="(section, index) in document.sections" :key="index" class="agreement-section">
      <h3>{{ section.title }}</h3>
      <template v-for="(block, blockIndex) in blocks(section)" :key="blockIndex">
        <ul v-if="block.list"><li v-for="(line, lineIndex) in block.lines" :key="lineIndex"><template v-for="(part, partIndex) in inline(line, section.formatted)" :key="partIndex"><strong v-if="part.bold">{{ part.text }}</strong><em v-else-if="part.italic">{{ part.text }}</em><template v-else>{{ part.text }}</template></template></li></ul>
        <p v-else><template v-for="(part, partIndex) in inline(block.text, section.formatted)" :key="partIndex"><strong v-if="part.bold">{{ part.text }}</strong><em v-else-if="part.italic">{{ part.text }}</em><template v-else>{{ part.text }}</template></template></p>
      </template>
    </section>
    <p class="agreement-acknowledgement">{{ document.acknowledgement }}</p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeContractAppearance } from '../../../../shared/clientContract.js'
const props = defineProps({ document: { type: Object, required: true } })
const appearance = computed(() => normalizeContractAppearance(props.document.appearance))
const documentStyle = computed(() => ({
  '--agreement-font': { sans: 'Arial, sans-serif', serif: 'Georgia, serif', classic: '"Times New Roman", serif' }[appearance.value.font],
  '--agreement-size': `${appearance.value.fontSize}px`, '--agreement-heading': appearance.value.headingColor,
  '--agreement-accent': appearance.value.accentColor, '--agreement-spacing': `${appearance.value.spacing}px`,
  '--agreement-alignment': appearance.value.alignment,
}))
const inline = (text, formatted) => {
  if (!formatted) return [{ text }]
  return String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map(part => part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : part.startsWith('*') && part.endsWith('*') ? { text: part.slice(1, -1), italic: true } : { text: part })
}
const blocks = section => {
  if (!section.formatted) return [{ text: section.text }]
  const result = []
  for (const line of String(section.text).split('\n')) {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!result.at(-1)?.list) result.push({ list: true, lines: [] })
      result.at(-1).lines.push(line.replace(/^\s*[-*]\s+/, ''))
    } else if (line.trim()) result.push({ text: line })
  }
  return result
}
</script>

<style scoped>
.client-agreement { padding: 24px; background: #fff; color: #352a24; overflow-wrap: anywhere; font-family: var(--agreement-font) !important; font-size: var(--agreement-size) !important; text-align: var(--agreement-alignment); line-height: 1.7; }
.client-agreement :is(h2, h3, p, li, strong, em) { font-family: inherit !important; }
.client-agreement :is(p, li) { font-size: inherit !important; color: #352a24 !important; white-space: pre-wrap; line-height: 1.7 !important; }
.client-agreement :is(h2, h3) { color: var(--agreement-heading) !important; font-weight: 700; letter-spacing: normal !important; }
.client-agreement h2 { font-size: 1.45em !important; margin: 8px 0; }
.client-agreement h3 { font-size: 1.1em !important; margin: 0 0 8px; }
.agreement-brand { padding-bottom: 16px; border-bottom: 2px solid var(--agreement-accent); }
.agreement-section, .agreement-acknowledgement { margin-top: var(--agreement-spacing); }
.agreement-section p + p { margin-top: 8px; }
.agreement-section ul { list-style: disc; padding-left: 24px; margin: 8px 0; }
.agreement-acknowledgement { padding-top: 16px; border-top: 1px solid var(--agreement-accent); }
@media (max-width: 640px) { .client-agreement { padding: 16px; } }
</style>
