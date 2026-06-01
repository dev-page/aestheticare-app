<template>
  <div class="min-h-screen bg-beige">
    <nav class="bg-white shadow-sm border-b border-light">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <h1 class="text-2xl font-bold text-gray-900">Clinic Dashboard</h1>
          <div class="flex space-x-4">
            <router-link
              to="/patients"
              class="text-gray-600 hover:text-brown px-3 py-2 rounded-md text-sm font-medium"
            >
              Patients
            </router-link>
            <router-link
              to="/appointments"
              class="text-gray-600 hover:text-brown px-3 py-2 rounded-md text-sm font-medium"
            >
              Appointments
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <DashboardSkeleton v-if="loading" />
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <router-link to="/patients" class="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition cursor-pointer">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Total Patients</dt>
                    <dd class="text-lg font-medium text-gray-900">{{ totalPatients }}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </router-link>

          <router-link to="/appointments" class="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition cursor-pointer">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Today's Appointments</dt>
                    <dd class="text-lg font-medium text-gray-900">{{ todaysAppointments }}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </router-link>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                    <dd class="text-lg font-medium text-gray-900">${{ monthlyRevenue }}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Pending Tasks</dt>
                    <dd class="text-lg font-medium text-gray-900">{{ pendingTasks }}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!loading" class="mt-8">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul class="divide-y divide-gray-200">
              <li v-for="activity in recentActivities" :key="activity.id" class="px-6 py-4">
                {{ activity.description }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'

//Static data
const loading = ref(true)
const totalPatients = ref(0)
const todaysAppointments = ref(0)
const monthlyRevenue = ref(0)
const pendingTasks = ref(0)
const recentActivities = ref([])

onMounted(() => {
  totalPatients.value = 150
  todaysAppointments.value = 12
  monthlyRevenue.value = 12500
  pendingTasks.value = 8
  recentActivities.value = [
    { id: 1, description: 'New patient registered: John Doe' },
    { id: 2, description: 'Appointment scheduled for Jane Smith' },
    { id: 3, description: 'Medical record updated for Bob Johnson' },
    { id: 4, description: 'Payment received from Alice Brown' },
    { id: 5, description: 'Prescription updated for Charlie Wilson' }
  ]
  loading.value = false
})
</script>
