<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- First Name -->
      <div>
        <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
          First Name *
        </label>
        <input
          id="firstName"
          v-model="form.firstName"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter first name"
        />
      </div>

      <!-- Last Name -->
      <div>
        <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
          Last Name *
        </label>
        <input
          id="lastName"
          v-model="form.lastName"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter last name"
        />
      </div>

      <!-- Email -->
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email *
        </label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter email address"
        />
      </div>

      <!-- Phone -->
      <div>
        <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
          Phone
        </label>
        <input
          id="phone"
          v-model="form.phone"
          type="tel"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter phone number"
        />
      </div>

      <!-- Date of Birth -->
      <div>
        <label for="dateOfBirth" class="block text-sm font-medium text-gray-700 mb-2">
          Date of Birth
        </label>
        <input
          id="dateOfBirth"
          v-model="form.dateOfBirth"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Status -->
      <div>
        <label for="status" class="block text-sm font-medium text-gray-700 mb-2">
          Status
        </label>
        <select
          id="status"
          v-model="form.status"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    <!-- Address Section -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Street Address -->
        <div class="md:col-span-2">
          <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
            Street Address
          </label>
          <input
            id="address"
            v-model="form.address"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter street address"
          />
        </div>

        <!-- City -->
        <div>
          <label for="city" class="block text-sm font-medium text-gray-700 mb-2">
            City
          </label>
          <input
            id="city"
            v-model="form.city"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter city"
          />
        </div>

        <!-- State/Province -->
        <div>
          <label for="state" class="block text-sm font-medium text-gray-700 mb-2">
            State/Province
          </label>
          <input
            id="state"
            v-model="form.state"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter state or province"
          />
        </div>

        <!-- ZIP/Postal Code -->
        <div>
          <label for="zipCode" class="block text-sm font-medium text-gray-700 mb-2">
            ZIP/Postal Code
          </label>
          <input
            id="zipCode"
            v-model="form.zipCode"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter ZIP or postal code"
          />
        </div>

        <!-- Country -->
        <div>
          <label for="country" class="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <input
            id="country"
            v-model="form.country"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter country"
          />
        </div>
      </div>
    </div>

    <!-- Emergency Contact -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Emergency Contact Name -->
        <div>
          <label for="emergencyName" class="block text-sm font-medium text-gray-700 mb-2">
            Contact Name
          </label>
          <input
            id="emergencyName"
            v-model="form.emergencyContact.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter emergency contact name"
          />
        </div>

        <!-- Emergency Contact Phone -->
        <div>
          <label for="emergencyPhone" class="block text-sm font-medium text-gray-700 mb-2">
            Contact Phone
          </label>
          <input
            id="emergencyPhone"
            v-model="form.emergencyContact.phone"
            type="tel"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter emergency contact phone"
          />
        </div>

        <!-- Emergency Contact Relationship -->
        <div>
          <label for="emergencyRelationship" class="block text-sm font-medium text-gray-700 mb-2">
            Relationship
          </label>
          <input
            id="emergencyRelationship"
            v-model="form.emergencyContact.relationship"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Spouse, Parent, Sibling"
          />
        </div>
      </div>
    </div>

    <!-- Medical Information -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Medical Information</h3>
      <div class="space-y-4">
        <!-- Allergies -->
        <div>
          <label for="allergies" class="block text-sm font-medium text-gray-700 mb-2">
            Allergies
          </label>
          <textarea
            id="allergies"
            v-model="form.medicalInfo.allergies"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="List any known allergies"
          ></textarea>
        </div>

        <!-- Current Medications -->
        <div>
          <label for="medications" class="block text-sm font-medium text-gray-700 mb-2">
            Current Medications
          </label>
          <textarea
            id="medications"
            v-model="form.medicalInfo.currentMedications"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="List current medications and dosages"
          ></textarea>
        </div>

        <!-- Medical Conditions -->
        <div>
          <label for="conditions" class="block text-sm font-medium text-gray-700 mb-2">
            Medical Conditions
          </label>
          <textarea
            id="conditions"
            v-model="form.medicalInfo.medicalConditions"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="List any medical conditions"
          ></textarea>
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
        {{ loading ? 'Saving...' : (isEditing ? 'Update Patient' : 'Add Patient') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const props = defineProps({
  patient: {
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

// Form data
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  status: 'active',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  emergencyContact: {
    name: '',
    phone: '',
    relationship: ''
  },
  medicalInfo: {
    allergies: '',
    currentMedications: '',
    medicalConditions: ''
  }
})

// Watch for patient prop changes (when editing)
watch(() => props.patient, (newPatient) => {
  if (newPatient && props.isEditing) {
    Object.assign(form, {
      ...newPatient,
      emergencyContact: newPatient.emergencyContact || { name: '', phone: '', relationship: '' },
      medicalInfo: newPatient.medicalInfo || { allergies: '', currentMedications: '', medicalConditions: '' }
    })
  }
}, { immediate: true })

const handleSubmit = async () => {
  loading.value = true
  try {
    const patientData = {
      ...form,
      updatedAt: new Date().toISOString()
    }

    if (props.isEditing) {
      patientData.id = props.patient.id
    } else {
      patientData.createdAt = new Date().toISOString()
    }

    emit('save', patientData)
  } catch (error) {
    console.error('Error saving patient:', error)
  } finally {
    loading.value = false
  }
}
</script>