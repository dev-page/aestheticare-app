<template>
  <div class="appointment-calendar">
    <div class="calendar-heading">
      <button type="button" :disabled="disabled || monthKey <= minDate.slice(0, 7)" aria-label="Previous month" @click="moveMonth(-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 6-6 6 6 6" /></svg></button>
      <h3>{{ monthLabel }}</h3>
      <button type="button" :disabled="disabled" aria-label="Next month" @click="moveMonth(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m10 6 6 6-6 6" /></svg></button>
    </div>
    <div class="calendar-grid">
      <span v-for="day in weekdays" :key="day" class="calendar-weekday">{{ day }}</span>
      <template v-for="(day, index) in calendarDays" :key="day?.date || `blank-${index}`">
        <span v-if="!day" aria-hidden="true" />
        <button v-else type="button" :disabled="disabled || !day.available" :class="{ 'is-selected': modelValue === day.date, 'is-today': day.date === minDate }" :aria-label="`${day.label}${day.available ? ', available' : ', unavailable'}`" :aria-pressed="modelValue === day.date" @click="$emit('update:modelValue', day.date)">{{ day.number }}<span v-if="day.available" class="calendar-dot" aria-hidden="true" /></button>
      </template>
    </div>
    <p class="calendar-help">{{ disabled ? 'Choose a service and practitioner to see available dates.' : 'Select an available date, then choose a time. One service per person per day.' }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ modelValue: { type: String, default: '' }, minDate: { type: String, required: true }, disabled: Boolean, isAvailable: { type: Function, default: () => true } })
defineEmits(['update:modelValue'])
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthKey = ref((props.modelValue || props.minDate).slice(0, 7))
const monthDate = computed(() => new Date(`${monthKey.value}-01T00:00:00Z`))
const monthLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthDate.value))
const moveMonth = amount => {
  const next = new Date(monthDate.value)
  next.setUTCMonth(next.getUTCMonth() + amount)
  monthKey.value = next.toISOString().slice(0, 7)
}
const calendarDays = computed(() => {
  const first = monthDate.value
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return [...Array((first.getUTCDay() + 6) % 7).fill(null), ...Array.from({ length: count }, (_, index) => {
    const number = index + 1, date = `${monthKey.value}-${String(number).padStart(2, '0')}`
    return { number, date, available: date >= props.minDate && !props.disabled && props.isAvailable(date), label: new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) }
  })]
})
watch(() => props.modelValue, date => { if (date) monthKey.value = date.slice(0, 7) })
</script>

<style scoped>
.appointment-calendar { border: 1px solid #ead2b7; border-radius: 12px; padding: 16px; background: #fffdf9; }
.calendar-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.calendar-heading h3 { margin: 0; font-size: 14px; font-weight: 600; color: #493225; }
.calendar-heading button { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #ead2b7; border-radius: 8px; background: #fff7ec; color: #805638; }
.calendar-heading svg { width: 18px; height: 18px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.calendar-weekday { padding: 4px 0 8px; text-align: center; color: #94745b; font-size: 10px; font-weight: 600; }
.calendar-grid button { position: relative; min-height: 37px; border: 1px solid transparent; border-radius: 8px; font-size: 12px; background: #f8eedf; color: #654733; }
.calendar-grid button:hover:not(:disabled) { border-color: #bc8b62; background: #f3e0c7; }
.calendar-grid button.is-selected { background: #8d5a3b; color: #fffdf9; }
.calendar-grid button.is-today { border-color: #bc8b62; }
.calendar-grid button:disabled { background: transparent; color: #c6b8ab; cursor: not-allowed; }
.calendar-heading button:disabled { opacity: .4; cursor: not-allowed; }
.calendar-dot { position: absolute; width: 3px; height: 3px; border-radius: 50%; bottom: 3px; left: calc(50% - 1.5px); background: currentColor; }
.calendar-help { margin: 12px 0 0; color: #896c56; font-size: 11px; line-height: 1.6; }
button:focus-visible { outline: 2px solid #b78055; outline-offset: 2px; }
</style>
