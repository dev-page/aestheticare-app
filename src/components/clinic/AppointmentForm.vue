<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Patient Selection -->
      <div class="md:col-span-2">
        <label for="patientId" class="block text-sm font-medium text-gray-700 mb-2">
          Patient *
        </label>
        <select
          id="patientId"
          v-model="form.patientId"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a patient</option>
          <option v-for="patient in patients" :key="patient.id" :value="patient.id">
            {{ patient.firstName }} {{ patient.lastName }} - {{ patient.email }}
          </option>
        </select>
      </div>

      <!-- Appointment Type -->
      <div>
        <label for="type" class="block text-sm font-medium text-gray-700 mb-2">
          Appointment Type *
        </label>
        <select
          id="type"
          v-model="form.type"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select type</option>
          <option value="General Checkup">General Checkup</option>
          <option value="Consultation">Consultation</option>
          <option value="Follow-up">Follow-up</option>
          <option value="Dental Cleaning">Dental Cleaning</option>
          <option value="X-Ray">X-Ray</option>
          <option value="Surgery">Surgery</option>
          <option value="Emergency">Emergency</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <!-- Date -->
      <div>
        <label for="date" class="block text-sm font-medium text-gray-700 mb-2">
          Date *
        </label>
        <input
          id="date"
          v-model="form.date"
          type="date"
          required
          :min="minDate"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Time -->
      <div>
        <label for="time" class="block text-sm font-medium text-gray-700 mb-2">
          Time *
        </label>
        <input
          id="time"
          v-model="form.time"
          type="time"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Duration -->
      <div>
        <label for="duration" class="block text-sm font-medium text-gray-700 mb-2">
          Duration (minutes) *
        </label>
        <select
          id="duration"
          v-model="form.duration"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
      </div>
    </div>

    <!-- Status (only for editing) -->
    <div v-if="isEditing">
      <label for="status" class="block text-sm font-medium text-gray-700 mb-2">
        Status
      </label>
      <select
        id="status"
        v-model="form.status"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="scheduled">Scheduled</option>
        <option value="confirmed">Confirmed</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>

    <!-- Notes -->
    <div>
      <label for="notes" class="block text-sm font-medium text-gray-700 mb-2">
        Notes
      </label>
      <textarea
        id="notes"
        v-model="form.notes"
        rows="4"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Additional notes or instructions..."
      ></textarea>
    </div>

    <!-- Recurring Appointment -->
    <div class="border-t pt-6">
      <div class="flex items-center">
        <input
          id="isRecurring"
          v-model="form.isRecurring"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="isRecurring" class="ml-2 block text-sm text-gray-900">
          This is a recurring appointment
        </label>
      </div>

      <div v-if="form.isRecurring" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="recurrenceType" class="block text-sm font-medium text-gray-700 mb-2">
            Recurrence
          </label>
          <select
            id="recurrenceType"
            v-model="form.recurrenceType"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label for="recurrenceEndDate" class="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            id="recurrenceEndDate"
            v-model="form.recurrenceEndDate"
            type="date"
            :min="form.date"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t">
      <button
        type="button"
        @click="$emit('cancel')"
        class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {{ loading ? 'Saving...' : (isEditing ? 'Update Appointment' : 'Schedule Appointment') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps({
  appointment: {
    type: Object,
    default: () => null
  },
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'cancel'])

const loading = ref(false)

// Mock patients data - replace with actual patient list
const patients = ref([
  { id: '1', firstName: 'John', lastName: 'Doe', email: 'john.doe@email.com' },
  { id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@email.com' },
  { id: '3', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@email.com' }
])

// Form data
const form = reactive({
  patientId: '',
  type: '',
  date: '',
  time: '',
  duration: '30',
  status: 'scheduled',
  notes: '',
  isRecurring: false,
  recurrenceType: 'weekly',
  recurrenceEndDate: ''
})

// Computed properties
const minDate = computed(() => {
  return new Date().toISOString().split('T')[0]
})

// Watch for appointment prop changes (when editing)
watch(() => props.appointment, (newAppointment) => {
  if (newAppointment && props.isEditing) {
    Object.assign(form, {
      ...newAppointment,
      isRecurring: newAppointment.isRecurring || false,
      recurrenceType: newAppointment.recurrenceType || 'weekly',
      recurrenceEndDate: newAppointment.recurrenceEndDate || ''
    })
  }
}, { immediate: true })

// Update patient name when patientId changes
watch(() => form.patientId, (newPatientId) => {
  if (newPatientId) {
    const patient = patients.value.find(p => p.id === newPatientId)
    if (patient) {
      form.patientName = `${patient.firstName} ${patient.lastName}`
    }
  }
})

const handleSubmit = async () => {
  loading.value = true
  try {
    const appointmentData = {
      ...form,
      updatedAt: new Date().toISOString()
    }

    if (props.isEditing) {
      appointmentData.id = props.appointment.id
    } else {
      appointmentData.createdAt = new Date().toISOString()
    }

    emit('save', appointmentData)
  } catch (error) {
    console.error('Error saving appointment:', error)
  } finally {
    loading.value = false
  }
}
</script>