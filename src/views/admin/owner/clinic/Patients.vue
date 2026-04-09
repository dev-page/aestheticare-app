<template>
  <div class="min-h-screen bg-beige">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-light">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Patients</h1>
            <p class="text-sm text-gray-600 mt-1">Manage patient records and information</p>
          </div>
          <button
            v-if="hasPermission('edit_patients')"
            @click="showAddPatientModal = true"
            class="bg-brown text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition"
          >
            Add Patient
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search patients..."
              class="w-full px-3 py-2 border border-light rounded-lg focus:ring-2 focus:ring-brown focus:border-transparent"
            />
          </div>
          <select
            v-model="statusFilter"
            class="px-3 py-2 border border-light rounded-lg focus:ring-2 focus:ring-brown focus:border-transparent">
            <option selected>All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <Table
          :headers="tableHeaders"
          :data="filteredPatients"
          :loading="loading"
          @row-click="handlePatientClick"
        >
          <template #actions="{ item }">
            <div class="flex space-x-2">
              <button
                v-if="hasPermission('edit_patients')"
                @click.stop="editPatient(item)"
                class="text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                v-if="hasPermission('view_patients')"
                @click.stop="viewPatient(item)"
                class="text-gray-600 hover:text-gray-800"
              >
                View
              </button>
            </div>
          </template>
        </Table>
      </div>

      <div class="flex justify-between items-center mt-6">
        <div class="text-sm text-gray-600">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, totalPatients) }} of {{ totalPatients }} patients
        </div>
        <div class="flex space-x-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <Modal
      :show="showAddPatientModal || showEditPatientModal"
      @close="closeModals"
      :title="showEditPatientModal ? 'Edit Patient' : 'Add New Patient'"
    >
      <PatientForm
        :patient="selectedPatient"
        :isEditing="showEditPatientModal"
        @save="handleSavePatient"
        @cancel="closeModals"
      />
    </Modal>

    <Modal
      :show="showViewPatientModal"
      @close="closeModals"
      :title="'Patient Details'"
    >
      <PatientDetails
        :patient="selectedPatient"
        @edit="editPatient(selectedPatient)"
        @close="closeModals"
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePermissions } from '@/composables/usePermissions'
import Table from '@/components/common/Table.vue'
import Modal from '@/components/common/Modal.vue'
import PatientForm from '@/components/clinic/PatientForm.vue'
import PatientDetails from '@/components/clinic/PatientDetails.vue'

const { hasPermission } = usePermissions()

const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const showAddPatientModal = ref(false)
const showEditPatientModal = ref(false)
const showViewPatientModal = ref(false)
const selectedPatient = ref(null)

// Static data
const patients = ref([
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@email.com',
    phone: '+1-555-0123',
    dateOfBirth: '1985-03-15',
    status: 'active',
    lastVisit: '2024-01-15',
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@email.com',
    phone: '+1-555-0124',
    dateOfBirth: '1990-07-22',
    status: 'active',
    lastVisit: '2024-01-10',
    createdAt: '2024-01-05'
  }
])

const tableHeaders = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'lastVisit', label: 'Last Visit' },
  { key: 'actions', label: 'Actions', sortable: false }
]

const filteredPatients = computed(() => {
  let filtered = patients.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(patient =>
      patient.firstName.toLowerCase().includes(query) ||
      patient.lastName.toLowerCase().includes(query) ||
      patient.email.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter(patient => patient.status === statusFilter.value)
  }

  return filtered
})

const totalPatients = computed(() => filteredPatients.value.length)
const totalPages = computed(() => Math.ceil(totalPatients.value / itemsPerPage.value))

const handlePatientClick = (patient) => {
  if (hasPermission('view_patients')) {
    viewPatient(patient)
  }
}

const viewPatient = (patient) => {
  selectedPatient.value = patient
  showViewPatientModal.value = true
}

const editPatient = (patient) => {
  if (hasPermission('edit_patients')) {
    selectedPatient.value = { ...patient }
    showEditPatientModal.value = true
    showViewPatientModal.value = false
  }
}

const handleSavePatient = async (patientData) => {
  try {
    if (showEditPatientModal.value) {
      const index = patients.value.findIndex(p => p.id === patientData.id)
      if (index !== -1) {
        patients.value[index] = { ...patients.value[index], ...patientData }
      }
    } else {
      const newPatient = {
        ...patientData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split('T')[0]
      }
      patients.value.push(newPatient)
    }

    closeModals()
  } catch (error) {
    console.error('Error saving patient:', error)
  }
}

const closeModals = () => {
  showAddPatientModal.value = false
  showEditPatientModal.value = false
  showViewPatientModal.value = false
  selectedPatient.value = null
}

onMounted(() => {
  loadPatients()
})

const loadPatients = async () => {
  loading.value = true
  try {
    // const querySnapshot = await getDocs(collection(db, 'patients'))
    // patients.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error loading patients:', error)
  } finally {
    loading.value = false
  }
}
</script>