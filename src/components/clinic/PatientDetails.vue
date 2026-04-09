<template>
  <div v-if="patient" class="space-y-6">
    <!-- Patient Header -->
    <div class="bg-gray-50 rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">
            {{ patient.firstName }} {{ patient.lastName }}
          </h2>
          <p class="text-gray-600">{{ patient.email }}</p>
          <p class="text-sm text-gray-500">{{ patient.phone }}</p>
        </div>
        <div class="flex items-center space-x-3">
          <span
            :class="[
              'px-3 py-1 rounded-full text-sm font-medium',
              patient.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            ]"
          >
            {{ patient.status === 'active' ? 'Active' : 'Inactive' }}
          </span>
          <button
            v-if="hasPermission('edit_patients')"
            @click="$emit('edit')"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Edit Patient
          </button>
        </div>
      </div>
    </div>

    <!-- Basic Information -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700">Date of Birth</label>
          <p class="mt-1 text-sm text-gray-900">{{ formatDate(patient.dateOfBirth) || 'Not provided' }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Phone</label>
          <p class="mt-1 text-sm text-gray-900">{{ patient.phone || 'Not provided' }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Last Visit</label>
          <p class="mt-1 text-sm text-gray-900">{{ formatDate(patient.lastVisit) || 'No visits yet' }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Patient Since</label>
          <p class="mt-1 text-sm text-gray-900">{{ formatDate(patient.createdAt) }}</p>
        </div>
      </div>
    </div>

    <!-- Address Information -->
    <div v-if="hasAddressInfo" class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Address Information</h3>
      <div class="text-sm text-gray-900">
        <p v-if="patient.address">{{ patient.address }}</p>
        <p v-if="patient.city || patient.state || patient.zipCode">
          {{ [patient.city, patient.state, patient.zipCode].filter(Boolean).join(', ') }}
        </p>
        <p v-if="patient.country">{{ patient.country }}</p>
      </div>
    </div>

    <!-- Emergency Contact -->
    <div v-if="hasEmergencyContact" class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700">Name</label>
          <p class="mt-1 text-sm text-gray-900">{{ patient.emergencyContact?.name || 'Not provided' }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Phone</label>
          <p class="mt-1 text-sm text-gray-900">{{ patient.emergencyContact?.phone || 'Not provided' }}</p>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700">Relationship</label>
          <p class="mt-1 text-sm text-gray-900">{{ patient.emergencyContact?.relationship || 'Not provided' }}</p>
        </div>
      </div>
    </div>

    <!-- Medical Information -->
    <div v-if="hasMedicalInfo" class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Medical Information</h3>
      <div class="space-y-4">
        <div v-if="patient.medicalInfo?.allergies">
          <label class="block text-sm font-medium text-gray-700">Allergies</label>
          <p class="mt-1 text-sm text-gray-900 whitespace-pre-line">{{ patient.medicalInfo.allergies }}</p>
        </div>
        <div v-if="patient.medicalInfo?.currentMedications">
          <label class="block text-sm font-medium text-gray-700">Current Medications</label>
          <p class="mt-1 text-sm text-gray-900 whitespace-pre-line">{{ patient.medicalInfo.currentMedications }}</p>
        </div>
        <div v-if="patient.medicalInfo?.medicalConditions">
          <label class="block text-sm font-medium text-gray-700">Medical Conditions</label>
          <p class="mt-1 text-sm text-gray-900 whitespace-pre-line">{{ patient.medicalInfo.medicalConditions }}</p>
        </div>
      </div>
    </div>

    <!-- Recent Appointments -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Recent Appointments</h3>
        <button
          v-if="hasPermission('manage_appointments')"
          class="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Schedule New
        </button>
      </div>
      <div v-if="recentAppointments.length > 0" class="space-y-3">
        <div
          v-for="appointment in recentAppointments"
          :key="appointment.id"
          class="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <p class="font-medium text-gray-900">{{ appointment.type }}</p>
            <p class="text-sm text-gray-600">{{ formatDate(appointment.date) }} at {{ appointment.time }}</p>
          </div>
          <span
            :class="[
              'px-2 py-1 rounded-full text-xs font-medium',
              appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
              appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            ]"
          >
            {{ appointment.status }}
          </span>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-500">
        <p>No appointments found</p>
        <button
          v-if="hasPermission('manage_appointments')"
          class="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Schedule first appointment
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3">
      <button
        @click="$emit('close')"
        class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
      >
        Close
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePermissions } from '@/composables/usePermissions'

const props = defineProps({
  patient: {
    type: Object,
    required: true
  }
})

defineEmits(['edit', 'close'])

const { hasPermission } = usePermissions()

// Computed properties
const hasAddressInfo = computed(() => {
  return props.patient.address || props.patient.city || props.patient.state || props.patient.zipCode || props.patient.country
})

const hasEmergencyContact = computed(() => {
  return props.patient.emergencyContact?.name || props.patient.emergencyContact?.phone || props.patient.emergencyContact?.relationship
})

const hasMedicalInfo = computed(() => {
  return props.patient.medicalInfo?.allergies || props.patient.medicalInfo?.currentMedications || props.patient.medicalInfo?.medicalConditions
})

// Mock recent appointments - replace with actual data
const recentAppointments = computed(() => {
  // In a real app, this would be fetched from Firestore
  return [
    {
      id: '1',
      type: 'General Checkup',
      date: '2024-01-15',
      time: '10:00 AM',
      status: 'completed'
    },
    {
      id: '2',
      type: 'Dental Cleaning',
      date: '2024-02-01',
      time: '2:00 PM',
      status: 'scheduled'
    }
  ]
})

// Methods
const formatDate = (dateString) => {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>