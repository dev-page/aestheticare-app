<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Appointments</h1>
            <p class="text-sm text-gray-600 mt-1">Schedule and manage patient appointments</p>
          </div>
          <button
            v-if="hasPermission('manage_appointments')"
            @click="showScheduleModal = true"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Schedule Appointment
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Filters and Calendar View Toggle -->
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="statusFilter"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              v-model="dateFilter"
              type="date"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div class="flex gap-2">
            <button
              @click="viewMode = 'list'"
              :class="[
                'px-4 py-2 rounded-lg transition',
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              ]"
            >
              List View
            </button>
            <button
              @click="viewMode = 'calendar'"
              :class="[
                'px-4 py-2 rounded-lg transition',
                viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              ]"
            >
              Calendar View
            </button>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-if="viewMode === 'list'" class="bg-white rounded-lg shadow-sm overflow-hidden">
        <Table
          :headers="tableHeaders"
          :data="filteredAppointments"
          :loading="loading"
          @row-click="handleAppointmentClick"
        >
          <template #status="{ item }">
            <span
              :class="[
                'px-2 py-1 rounded-full text-xs font-medium',
                getStatusColor(item.status)
              ]"
            >
              {{ item.status }}
            </span>
          </template>
          <template #actions="{ item }">
            <div class="flex space-x-2">
              <button
                v-if="hasPermission('manage_appointments')"
                @click.stop="editAppointment(item)"
                class="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                v-if="hasPermission('manage_appointments') && item.status === 'scheduled'"
                @click.stop="cancelAppointment(item)"
                class="text-red-600 hover:text-red-800"
              >
                Cancel
              </button>
            </div>
          </template>
        </Table>
      </div>

      <div v-else class="bg-white rounded-lg shadow-sm p-6">
        <div class="text-center py-12">
          <div class="text-gray-400 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Calendar View</h3>
          <p class="text-gray-500">Calendar integration coming soon...</p>
        </div>
      </div>

      <Modal
        :show="showScheduleModal || showEditModal"
        @close="closeModals"
        :title="showEditModal ? 'Edit Appointment' : 'Schedule New Appointment'"
      >
        <AppointmentForm
          :appointment="selectedAppointment"
          :isEditing="showEditModal"
          @save="handleSaveAppointment"
          @cancel="closeModals"
        />
      </Modal>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePermissions } from '@/composables/usePermissions'
import Table from '@/components/common/Table.vue'
import Modal from '@/components/common/Modal.vue'
import AppointmentForm from '@/components/clinic/AppointmentForm.vue'

const { hasPermission } = usePermissions()

const loading = ref(false)
const viewMode = ref('list')
const statusFilter = ref('')
const dateFilter = ref('')
const selectedAppointment = ref(null)

const showScheduleModal = ref(false)
const showEditModal = ref(false)

//Static data
const appointments = ref([
  {
    id: '1',
    patientName: 'John Doe',
    patientId: '1',
    type: 'General Checkup',
    date: '2024-01-20',
    time: '10:00 AM',
    duration: 30,
    status: 'scheduled',
    notes: 'Regular checkup',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    patientName: 'Jane Smith',
    patientId: '2',
    type: 'Dental Cleaning',
    date: '2024-01-22',
    time: '2:00 PM',
    duration: 60,
    status: 'confirmed',
    notes: 'Professional cleaning',
    createdAt: '2024-01-18'
  },
  {
    id: '3',
    patientName: 'Bob Johnson',
    patientId: '3',
    type: 'Consultation',
    date: '2024-01-25',
    time: '11:30 AM',
    duration: 45,
    status: 'completed',
    notes: 'Follow-up consultation',
    createdAt: '2024-01-20'
  }
])

const tableHeaders = [
  { key: 'patientName', label: 'Patient' },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'duration', label: 'Duration' },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false }
]

const filteredAppointments = computed(() => {
  let filtered = appointments.value

  if (statusFilter.value) {
    filtered = filtered.filter(appointment => appointment.status === statusFilter.value)
  }

  if (dateFilter.value) {
    filtered = filtered.filter(appointment => appointment.date === dateFilter.value)
  }

  return filtered.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time))
})

const handleAppointmentClick = (appointment) => {
  if (hasPermission('manage_appointments')) {
    viewAppointment(appointment)
  }
}

const viewAppointment = (appointment) => {
  editAppointment(appointment)
}

const editAppointment = (appointment) => {
  if (hasPermission('manage_appointments')) {
    selectedAppointment.value = { ...appointment }
    showEditModal.value = true
  }
}

const cancelAppointment = async (appointment) => {
  if (confirm('Are you sure you want to cancel this appointment?')) {
    try {
      const index = appointments.value.findIndex(a => a.id === appointment.id)
      if (index !== -1) {
        appointments.value[index].status = 'cancelled'
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
    }
  }
}

const handleSaveAppointment = async (appointmentData) => {
  try {
    if (showEditModal.value) {
      const index = appointments.value.findIndex(a => a.id === appointmentData.id)
      if (index !== -1) {
        appointments.value[index] = { ...appointments.value[index], ...appointmentData }
      }
    } else {
      const newAppointment = {
        ...appointmentData,
        id: Date.now().toString(),
        status: 'scheduled',
        createdAt: new Date().toISOString()
      }
      appointments.value.push(newAppointment)
    }

    closeModals()
  } catch (error) {
    console.error('Error saving appointment:', error)
  }
}

const closeModals = () => {
  showScheduleModal.value = false
  showEditModal.value = false
  selectedAppointment.value = null
}

const getStatusColor = (status) => {
  const colors = {
    scheduled: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

// Lifecycle
onMounted(() => {
  loadAppointments()
})

const loadAppointments = async () => {
  loading.value = true
  try {
    // const querySnapshot = await getDocs(collection(db, 'appointments'))
    // appointments.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error loading appointments:', error)
  } finally {
    loading.value = false
  }
}
</script>