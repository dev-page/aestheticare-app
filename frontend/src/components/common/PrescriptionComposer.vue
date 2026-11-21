<template>
  <section class="prescription-composer" aria-label="Prescription items">
    <div class="composer-heading">
      <div>
        <h3>Prescription items</h3>
        <p>Select medicines configured for prescription dispensing in this branch’s inventory.</p>
      </div>
      <button type="button" class="add-button" :disabled="loading || rows.length >= 20 || !items.length" @click="addRow">Add item</button>
    </div>

    <p v-if="loading" class="composer-message">Loading branch inventory…</p>
    <p v-else-if="error" class="composer-message error" role="alert">{{ error }}</p>
    <p v-else-if="!items.length" class="composer-message">No inventory items are currently set up for prescription dispensing. Configure an item in Inventory first.</p>
    <p v-else-if="!rows.length" class="composer-message">No prescription items added. The consultation can be completed without a prescription.</p>

    <div v-if="legacyPrescriptions.length" class="saved-items">
      <p>Previously entered prescription items are kept on this record. To dispense one, add its matching inventory item above; remove the old entry if it is no longer needed.</p>
      <div v-for="(item, index) in legacyPrescriptions" :key="`saved-${index}`" class="saved-item">
        <span>{{ item.name || item.medication || item.productName || 'Prescription item' }} · {{ item.quantity || 'quantity not set' }}</span>
        <button type="button" class="remove-button" @click="removeLegacy(index)">Remove</button>
      </div>
    </div>

    <article v-for="(row, index) in rows" :key="row.key" class="prescription-row">
      <div class="row-heading">
        <strong>Item {{ index + 1 }}</strong>
        <button type="button" class="remove-button" @click="removeRow(index)">Remove</button>
      </div>
      <label class="field field-wide">
        Medicine or inventory item
        <select v-model="row.inventoryItemId" @change="emitValue">
          <option value="">Select an inventory item</option>
          <option v-for="item in items" :key="item.id" :value="item.id" :disabled="itemAlreadySelected(item.id, index)">
            {{ item.name }} · {{ item.currentStock }} {{ item.unit }} in stock
          </option>
        </select>
      </label>
      <div class="field-grid">
        <label class="field">Dosage / strength<input v-model.trim="row.dosage" maxlength="160" placeholder="e.g. 250 mg" @input="emitValue" /></label>
        <label class="field">Frequency<input v-model.trim="row.frequency" maxlength="160" placeholder="e.g. twice daily" @input="emitValue" /></label>
        <label class="field">Duration<input v-model.trim="row.duration" maxlength="160" placeholder="e.g. 5 days" @input="emitValue" /></label>
        <label class="field">Quantity to dispense<input v-model.number="row.quantity" type="number" min="1" step="1" required @input="emitValue" /></label>
      </div>
      <label class="field field-wide">Instructions<input v-model.trim="row.instructions" maxlength="500" placeholder="Optional instructions for the customer" @input="emitValue" /></label>
      <p v-if="row.inventoryItemId && Number(row.quantity) > Number(selectedItem(row.inventoryItemId)?.currentStock || 0)" class="stock-note">
        Requested quantity is above current stock. Pharmacy may need to fulfill it in more than one visit.
      </p>
    </article>
    <p v-if="rows.some(row => !row.inventoryItemId || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 1)" class="validation-note">
      Select an inventory item and enter a whole-number quantity for each row, or remove the incomplete row.
    </p>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { getAuth } from 'firebase/auth'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const props = defineProps({
  appointmentId: { type: String, required: true },
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'validity'])
const items = ref([]), rows = ref([]), legacyPrescriptions = ref([]), loading = ref(false), error = ref('')
let rowCounter = 0, requestGeneration = 0

const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const selectedItem = id => items.value.find(item => item.id === id)
const itemAlreadySelected = (id, index) => rows.value.some((row, rowIndex) => rowIndex !== index && row.inventoryItemId === id)
const makeRow = (value = {}, inventoryItemId = '') => ({
  key: `prescription-${++rowCounter}`,
  inventoryItemId,
  dosage: String(value.dosage || value.strength || ''),
  frequency: String(value.frequency || ''),
  duration: String(value.duration || ''),
  instructions: String(value.instructions || value.notes || ''),
  quantity: Number(value.quantity || 1),
})

const emitValue = () => {
  const complete = rows.value.every(row => row.inventoryItemId && Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0)
  const selected = rows.value.filter(row => row.inventoryItemId && Number.isSafeInteger(Number(row.quantity)) && Number(row.quantity) > 0).map(row => {
    const item = selectedItem(row.inventoryItemId)
    return {
      inventoryItemId: item.id,
      name: item.name,
      unit: item.unit,
      dosage: row.dosage.trim(),
      frequency: row.frequency.trim(),
      duration: row.duration.trim(),
      instructions: row.instructions.trim(),
      quantity: Number(row.quantity),
    }
  })
  const value = [...selected, ...legacyPrescriptions.value]
  emit('update:modelValue', value)
  emit('validity', complete)
}

const addRow = () => {
  if (rows.value.length >= 20 || !items.value.length) return
  rows.value.push(makeRow())
  emitValue()
}
const removeRow = index => { rows.value.splice(index, 1); emitValue() }
const removeLegacy = index => { legacyPrescriptions.value.splice(index, 1); emitValue() }

const loadItems = async () => {
  const run = ++requestGeneration
  items.value = []
  rows.value = []
  legacyPrescriptions.value = []
  error.value = ''
  if (!props.appointmentId) return
  loading.value = true
  try {
    const user = getAuth().currentUser
    if (!user) throw new Error('Sign in again to load this branch inventory.')
    const token = await user.getIdToken()
    let response, lastError
    for (const baseUrl of OTP_BACKEND_CANDIDATES) {
      try {
        response = await fetch(`${baseUrl}/appointments/${encodeURIComponent(props.appointmentId)}/prescription-inventory`, { headers: { Authorization: `Bearer ${token}` } })
        if (response.status === 404) continue
        break
      } catch (cause) { lastError = cause }
    }
    if (!response) throw lastError || new Error('Unable to reach the clinic service.')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load prescription inventory.')
    if (run !== requestGeneration) return
    items.value = Array.isArray(payload.data?.items) ? payload.data.items : []
    const existing = Array.isArray(props.modelValue) ? props.modelValue : []
    rows.value = []
    legacyPrescriptions.value = []
    existing.forEach(rawEntry => {
      const entry = typeof rawEntry === 'string' ? { name: rawEntry } : rawEntry && typeof rawEntry === 'object' ? rawEntry : {}
      const exact = String(entry.inventoryItemId || entry.itemId || '')
      const nameMatch = items.value.filter(item => normalizeName(item.name) === normalizeName(entry.name || entry.medication || entry.productName))
      const match = items.value.find(item => item.id === exact) || (nameMatch.length === 1 ? nameMatch[0] : null)
      if (match) rows.value.push(makeRow(entry, match.id))
      else legacyPrescriptions.value.push({ ...entry })
    })
    emitValue()
  } catch (cause) {
    if (run === requestGeneration) error.value = cause.message || 'Unable to load prescription inventory.'
  } finally { if (run === requestGeneration) loading.value = false }
}

watch(() => props.appointmentId, loadItems)
onMounted(loadItems)
</script>

<style scoped>
.prescription-composer{display:grid;gap:.8rem;margin:1rem 0;padding:1rem;border:1px solid #ead8c2;border-radius:.85rem;background:#fffaf3;color:#3d281d}.composer-heading,.row-heading,.saved-item{display:flex;align-items:center;justify-content:space-between;gap:.8rem}.composer-heading h3{margin:0;font-size:.98rem;font-weight:700}.composer-heading p,.composer-message{margin:.25rem 0 0;color:#806b5a;font-size:.82rem;line-height:1.45}.add-button,.remove-button{border:1px solid #d8b994;border-radius:.55rem;background:#f5e9d9;padding:.45rem .7rem;color:#68452f;font-size:.82rem;font-weight:650}.add-button:disabled{opacity:.5}.prescription-row{display:grid;gap:.75rem;padding:.85rem;border:1px solid #ead8c2;border-radius:.7rem;background:#fffdf9}.row-heading strong{font-size:.85rem}.field{display:grid;gap:.3rem;color:#684c37;font-size:.78rem;font-weight:650}.field input,.field select{width:100%;min-width:0;border:1px solid #dec7aa;border-radius:.5rem;background:white;padding:.58rem .65rem;color:#3d281d;font-size:.85rem;font-weight:400}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}.field-wide{width:100%}.stock-note,.validation-note,.saved-items>p{margin:0;color:#8a5c32;font-size:.78rem;line-height:1.45}.saved-items{display:grid;gap:.5rem;padding:.75rem;border:1px solid #ecd6a8;border-radius:.65rem;background:#fff7e5}.saved-item{font-size:.8rem;color:#684c37}.error{color:#9b3027}@media(max-width:600px){.composer-heading{align-items:flex-start;flex-direction:column}.field-grid{grid-template-columns:1fr}}
</style>
