<template>
  <div ref="agreementElement" class="clinic-agreement" @scroll="handleScroll">
    <p class="text-xs text-slate-500">Agreement version: {{ version }} | Last updated: {{ agreement.lastUpdated }}</p>

    <h2>{{ agreement.title }}</h2>
    <p>{{ agreement.introduction }}</p>

    <template v-for="section in agreement.sections" :key="section.heading">
      <h3>{{ section.heading }}</h3>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      <ul v-if="section.bullets?.length">
        <li v-for="bullet in section.bullets" :key="bullet.label"><strong>{{ bullet.label }}</strong> {{ bullet.text }}</li>
      </ul>
      <p v-for="paragraph in section.closingParagraphs || []" :key="paragraph">{{ paragraph }}</p>
    </template>

    <div v-if="!reachedEnd" class="clinic-agreement-hint">
      Scroll to the end of this agreement to enable acceptance.
    </div>
    <div v-else class="clinic-agreement-hint clinic-agreement-hint-ready">
      You have reached the end of the agreement. You may now close this window and sign below.
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { CLINIC_PLATFORM_AGREEMENT } from '../../../../shared/clinicPlatformAgreement.js'

defineProps({
  version: {
    type: String,
    default: 'clinic-platform-agreement-v1',
  },
})

const emit = defineEmits(['reached-end'])
const agreement = CLINIC_PLATFORM_AGREEMENT
const agreementElement = ref(null)
const reachedEnd = ref(false)

const markReachedEndIfReady = (element) => {
  if (!element) return
  const isAtEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 12
  if (isAtEnd && !reachedEnd.value) {
    reachedEnd.value = true
    emit('reached-end')
  }
}

const handleScroll = (event) => markReachedEndIfReady(event.currentTarget)

onMounted(() => {
  nextTick(() => markReachedEndIfReady(agreementElement.value))
})
</script>

<style scoped>
.clinic-agreement {
  max-height: min(65vh, 620px);
  overflow-y: auto;
  padding: 1rem;
  color: #4a3427;
  line-height: 1.65;
}

.clinic-agreement h2 {
  margin-top: 1rem;
  color: #2f1d14;
  font-size: 1.35rem;
  font-weight: 700;
}

.clinic-agreement h3 {
  margin-top: 1.35rem;
  color: #704725;
  font-size: 1rem;
  font-weight: 700;
}

.clinic-agreement ul {
  margin: 0.65rem 0 0.65rem 1.25rem;
  list-style: disc;
}

.clinic-agreement-hint {
  position: sticky;
  bottom: 0;
  margin-top: 1.5rem;
  padding: 0.75rem;
  border: 1px solid #e2b47c;
  border-radius: 0.75rem;
  background: #fff7ed;
  color: #8a541f;
  font-size: 0.8rem;
}

.clinic-agreement-hint-ready {
  border-color: #8ac9a9;
  background: #effaf3;
  color: #1e7045;
}
</style>
