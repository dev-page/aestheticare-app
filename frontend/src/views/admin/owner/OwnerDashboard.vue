<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, nextTick, computed } from 'vue'
import { auth } from '@/config/firebaseConfig'
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { RouterLink } from 'vue-router'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { revenueByBranch, revenueTransactionAmount, sumNetRevenue } from '@/utils/revenue'
import { useSubscriptionStore } from '@/stores/subscription'

export default {
  name: 'OwnerDashboard',
  components: { OwnerSidebar, DashboardSkeleton, RouterLink },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const subscriptionStore = useSubscriptionStore()
    const loading = ref(true)
    const setupPolicyConfigured = ref(false)
    const setupListings = ref([])
    const selectedSetupBranchId = ref('')

    const totalBranches = ref(0)
    const totalEmployees = ref(0)
    const monthlyRevenue = ref(0)
    const totalClients = ref(0)
    const todayAppointments = ref(0)
    const unreadMessages = ref(0)
    const todaysRevenue = ref(0)
    const pendingRequests = ref(0)
    const lowStockCount = ref(0)
    const operationsSummary = computed(() => [
      { label: "Today's appointments", count: todayAppointments.value, color: '#bd875e' },
      { label: 'Unread messages', count: unreadMessages.value, color: '#d2a675' },
      { label: 'Pending purchase requests', count: pendingRequests.value, color: '#977352' },
      { label: 'Low-stock items', count: lowStockCount.value, color: '#b45e49' },
    ])
    const operationsMaximum = computed(() => Math.max(1, ...operationsSummary.value.map(item => item.count)))

    const branches = ref([])
    const staff = ref([])
    const appointments = ref([])
    const transactions = ref([])
    const inventoryItems = ref([])
    const purchaseRequests = ref([])
    const messages = ref([])

    const activeSetupBranches = computed(() => branches.value.filter(branch => !branch.archived))
    const setupBranch = computed(() => activeSetupBranches.value.find(branch => branch.id === selectedSetupBranchId.value) || activeSetupBranches.value[0] || null)
    const setupTasks = computed(() => {
      const linkedKeys = setupBranch.value?.enforcedPolicyKeys
      const policiesLinked = Array.isArray(linkedKeys)
        ? linkedKeys.some(key => ['paymentPolicy', 'cancellationPolicy', 'reschedulePolicy', 'noShowPolicy', 'walkInPolicy'].includes(key))
        : Boolean(setupBranch.value?.policiesLinkedAt)
      const postTypes = new Set(setupListings.value.map(post => String(post.postType || '').toLowerCase()))
      const plan = String(subscriptionStore.activePlan || 'free').toLowerCase()
      const canCreateAllListings = plan === 'basic' || plan === 'premium'
      return [
        { key: 'policies', label: 'Configure clinic policies', description: 'Choose and save the policies customers should follow.', done: setupPolicyConfigured.value, to: '/clinic/policies', action: 'Configure policies' },
        { key: 'link-policies', label: 'Link policies to a branch', description: 'Choose which saved policies apply at your branch.', done: policiesLinked, to: '/clinic/branches', action: 'Link policies', disabled: !setupBranch.value },
        { key: 'clinic-logo', label: 'Upload your clinic logo', description: 'Add the logo customers will see on your public clinic page.', done: Boolean(setupBranch.value?.profilePicture), to: { path: '/clinic/page', query: { branchId: setupBranch.value?.id || '', edit: 'branding' } }, action: 'Add logo', disabled: !setupBranch.value },
        { key: 'clinic-banner', label: 'Upload a clinic banner', description: 'Add a banner image for your public clinic page.', done: Boolean(setupBranch.value?.bannerPicture), to: { path: '/clinic/page', query: { branchId: setupBranch.value?.id || '', edit: 'branding' } }, action: 'Add banner', disabled: !setupBranch.value },
        { key: 'employee', label: 'Add your first employee', description: 'Create at least one employee account for your clinic.', done: totalEmployees.value > 0, to: '/hr/employees/new', action: 'Add employee' },
        { key: 'consultation', label: 'Add a consultation', description: 'Create a consultation listing for your clinic.', done: postTypes.has('consultation'), to: '/catalog/products-services', action: canCreateAllListings ? 'Add consultation' : 'Upgrade to add', disabled: !canCreateAllListings },
        { key: 'service', label: 'Add a service', description: 'Create a service customers can book.', done: postTypes.has('service'), to: '/catalog/products-services', action: 'Add service', disabled: plan !== 'free' && !canCreateAllListings },
        { key: 'package', label: 'Add a package', description: 'Bundle services into a treatment package.', done: postTypes.has('package'), to: '/catalog/products-services', action: canCreateAllListings ? 'Add package' : 'Upgrade to add', disabled: !canCreateAllListings },
      ]
    })
    const setupCompletedCount = computed(() => setupTasks.value.filter(task => task.done).length)
    const setupComplete = computed(() => setupTasks.value.length > 0 && setupCompletedCount.value === setupTasks.value.length)

    const revenueChartRef = ref(null)
    const employeeChartRef = ref(null)
    let revenueChartInstance = null
    let employeeChartInstance = null
    let chartModulePromise = null
    let chartModule = null

    const loadChartModule = trackPageLoad(async () => {
      if (chartModule) return chartModule
      if (!chartModulePromise) {
        chartModulePromise = import('chart.js').then((module) => {
          chartModule = module
          chartModule.Chart.register(...module.registerables)
          return module
        })
      }
      return chartModulePromise
    })

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const fetchByBranchIds = trackPageLoad(async (collectionName, branchIds) => {
      if (!branchIds.length) return []

      const chunks = chunkArray(branchIds)
      let results = []

      for (const chunk of chunks) {
        const collectionQuery = query(
          collection(db, collectionName),
          where('branchId', 'in', chunk)
        )
        const snapshot = await getDocs(collectionQuery)
        results = results.concat(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
      }

      return results
    })

    const loadDashboardCollection = trackPageLoad(async (collectionName, branchIds) => {
      try {
        return await fetchByBranchIds(collectionName, branchIds)
      } catch (error) {
        const permissionDenied = String(error?.code || '') === 'permission-denied'
          || String(error?.message || '').includes('Missing or insufficient permissions')
        // A dashboard card must never prevent a Basic clinic from opening its
        // operational workspace. The collection remains protected by rules;
        // unavailable cards simply start empty until their data is accessible.
        if (permissionDenied) return []
        throw error
      }
    })

    const isPermissionDenied = (error) =>
      String(error?.code || '') === 'permission-denied'
      || String(error?.message || '').includes('Missing or insufficient permissions')

    const toTimestampDate = (value) => (value?.toDate ? value.toDate() : null)
    const todayKey = () => {
      const today = new Date()
      const month = `${today.getMonth() + 1}`.padStart(2, '0')
      const day = `${today.getDate()}`.padStart(2, '0')
      return `${today.getFullYear()}-${month}-${day}`
    }

    const normalizeAppointmentStatus = (value) => String(value || '').trim().toLowerCase()
    const isCancelledAppointment = (appointment) => {
      const status = normalizeAppointmentStatus(appointment?.status)
      return status === 'cancelled' || status === 'canceled'
    }

    const getEffectiveMaxStock = (item) => {
      const explicitMax = Number(item.maxStock || 0)
      if (explicitMax > 0) return explicitMax
      return Number(item.currentStock || 0)
    }

    const loadDashboardData = trackPageLoad(async () => {
      loading.value = true
      try {
        const user = auth.currentUser
        if (!user) return

        const branchQuery = query(
          collection(db, "clinics"),
          where("ownerId", "==", user.uid)
        )

        let branchSnapshot
        try {
          branchSnapshot = await getDocs(branchQuery)
        } catch (error) {
          if (isPermissionDenied(error)) {
            branches.value = []
            staff.value = []
            return
          }
          throw error
        }
        const branchData = branchSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))

        const branchIds = branchData.map(b => b.id)
        if (!branchIds.includes(selectedSetupBranchId.value)) {
          selectedSetupBranchId.value = branchData.find(branch => !branch.archived)?.id || branchData[0]?.id || ''
        }

        try {
          let policies = await getDoc(doc(db, 'clinicPolicies', user.uid))
          if (!policies.exists() && branchData.length) policies = await getDoc(doc(db, 'clinicPolicies', branchData[0].id))
          const policyData = policies.exists() ? policies.data() || {} : {}
          setupPolicyConfigured.value = [
            policyData.servicePaymentPolicyEnabled,
            policyData.paymentPolicyEnabled,
            policyData.serviceCancellationPolicyEnabled,
            policyData.cancellationPolicyEnabled,
            policyData.serviceReschedulingPolicyEnabled,
            policyData.reschedulePolicyEnabled,
            policyData.serviceNoShowPolicyEnabled,
            policyData.noShowPolicyEnabled,
            policyData.walkInPolicyEnabled,
          ].some(value => value === true)
        } catch (error) {
          if (!isPermissionDenied(error)) throw error
          setupPolicyConfigured.value = false
        }

        let staffData = []
        if (branchIds.length) {
          const chunks = chunkArray(branchIds)
          for (const chunk of chunks) {
            const staffQuery = query(
              collection(db, "users"),
              where("branchId", "in", chunk),
              where("userType", "==", "Staff")
            )
            try {
              const staffSnapshot = await getDocs(staffQuery)
              staffData = staffData.concat(
                staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
              )
            } catch (error) {
              if (!isPermissionDenied(error)) throw error
            }
          }
          staffData = staffData.filter((u) => !u.archived)
        }

        staff.value = staffData
        totalEmployees.value = staff.value.length

        const [clientsData, appointmentsData, transactionsData, inventoryData, purchaseRequestData, messageData, listingData] = await Promise.all([
          loadDashboardCollection('clients', branchIds),
          loadDashboardCollection('appointments', branchIds),
          loadDashboardCollection('transactions', branchIds),
          loadDashboardCollection('inventoryItems', branchIds),
          loadDashboardCollection('purchaseRequests', branchIds),
          loadDashboardCollection('messages', branchIds),
          loadDashboardCollection('productServicePosts', branchIds)
        ])

        appointments.value = sortRecordsNewestFirst(appointmentsData)
        transactions.value = sortRecordsNewestFirst(transactionsData)
        const branchRevenue = revenueByBranch(transactions.value)
        branches.value = branchData.map(branch => ({ ...branch, revenue: branchRevenue[branch.id] || 0 }))
        totalBranches.value = branches.value.length
        inventoryItems.value = sortRecordsNewestFirst(inventoryData)
        purchaseRequests.value = sortRecordsNewestFirst(purchaseRequestData)
        messages.value = sortRecordsNewestFirst(messageData)
        setupListings.value = listingData.filter(post => post.archived !== true)

        totalClients.value = clientsData.length
        unreadMessages.value = messages.value.filter((item) => !item.isRead).length
        todayAppointments.value = appointments.value.filter((item) => item.date === todayKey()).length
        todaysRevenue.value = transactions.value.reduce((sum, entry) => {
          const createdAt = toTimestampDate(entry.createdAt)
          const now = new Date()
          const isToday =
            createdAt &&
            createdAt.getFullYear() === now.getFullYear() &&
            createdAt.getMonth() === now.getMonth() &&
            createdAt.getDate() === now.getDate()

          return isToday ? sum + revenueTransactionAmount(entry) : sum
        }, 0)
        pendingRequests.value = purchaseRequests.value.filter(
          (item) => String(item.status || 'Pending').toLowerCase() === 'pending'
        ).length
        lowStockCount.value = inventoryItems.value.filter((item) => {
          const stock = Number(item.currentStock || 0)
          const minStock = Number(item.minStock || 0)
          const maxStock = Number(getEffectiveMaxStock(item) || 0)
          const explicitStatus = String(item.stockStatus || '').trim().toLowerCase()

          if (explicitStatus === 'low stock') return true
          if (explicitStatus === 'out of stock') return false
          if (minStock > 0) return stock > 0 && stock < minStock
          return maxStock > 0 ? stock < maxStock * 0.5 : false
        }).length

        monthlyRevenue.value = sumNetRevenue(transactions.value)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        loading.value = false
        await nextTick()
        renderRevenueChart()
        renderEmployeeChart()
      }
    })
    const renderRevenueChart = () => {
      if(!revenueChartRef.value) return

      const labels = branches.value.map(b => `${b.clinicBranch} (${b.clinicLocation || 'Unknown'})`)
      const revenues = branches.value.map(b => b.revenue || 0)

      if(revenueChartInstance) revenueChartInstance.destroy()

      revenueChartInstance = new chartModule.Chart(revenueChartRef.value, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Revenue (PHP)',
              data: revenues,
              backgroundColor: 'rgba(214, 169, 123, 0.8)',
              borderColor: 'rgba(241, 212, 170, 0.95)',
              borderWidth: 1,
              borderRadius: 12,
              borderSkipped: false,
              maxBarThickness: 52
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Branch Performance',
              color: '#342419',
              font: { size: 16, weight: '700' },
              padding: { bottom: 16 }
            },
            legend: {
              labels: {
                color: '#624733',
                boxWidth: 14,
                boxHeight: 14
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#624733' },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#624733' },
              grid: { color: 'rgba(207,159,120,.22)' }
            }
          }
        }
      })
    }

const renderEmployeeChart = () => {
  if (!employeeChartRef.value) return

  const roleCounts = {}
  let totalStaff = 0

  staff.value.forEach((member) => {
    const rawRole = String(member.role || '').trim()
    const normalizedRole = rawRole
      ? `${rawRole.charAt(0).toUpperCase()}${rawRole.slice(1).toLowerCase()}`
      : 'Unassigned'
    roleCounts[normalizedRole] = (roleCounts[normalizedRole] || 0) + 1
    totalStaff += 1
  })

  const labels = Object.keys(roleCounts)
  const data = Object.values(roleCounts)
  const palette = [
    '#ffd3ac',
    '#ccbeb1',
    '#664c36',
    '#331c08',
    '#c98700',
    '#e0a010',
    '#ffc62e',
    '#ffd866'
  ]
  const chartColors = labels.map((_label, index) => palette[index % palette.length])
  const borderColors = labels.map((_label, index) => palette[index % palette.length])

  if (employeeChartInstance) employeeChartInstance.destroy()

  employeeChartInstance = new chartModule.Chart(employeeChartRef.value, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [{
        label: 'Employees by Role',
        data: data.length > 0 ? data : [1],
        backgroundColor: data.length > 0 ? chartColors : ['rgba(128,128,128,0.5)'],
        borderColor: data.length > 0 ? borderColors : ['rgba(128,128,128,1)'],
        borderWidth: 0,
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 2,
        cutout: '56%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Employees Distribution by Role',
          color: '#342419',
          font: { size: 16, weight: '700' },
          padding: { bottom: 16 }
        },
        legend: {
          position: 'top',
          labels: {
            color: '#624733',
            boxWidth: 14,
            boxHeight: 14
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (data.length === 0) return 'No data'
              const value = context.raw
              const percentage = ((value / totalStaff) * 100).toFixed(1)
              return `${context.label}: ${value} (${percentage}%)`
            }
          }
        }
      }
    }
})

}

    onMounted(trackPageLoad(() => {
      pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) return
        await loadChartModule()
        await loadDashboardData()
      })
    }))

    const upcomingAppointments = computed(() =>
      [...appointments.value]
        .filter((item) => (item.date || '') >= todayKey() && !isCancelledAppointment(item))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime()
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime()
          return bTime - aTime
        })
        .slice(0, 6)
    )

    const recentTransactions = computed(() =>
      [...transactions.value]
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 6)
    )

    const lowStockItems = computed(() =>
      [...inventoryItems.value]
        .filter((item) => {
          const stock = Number(item.currentStock || 0)
          const minStock = Number(item.minStock || 0)
          const maxStock = Number(getEffectiveMaxStock(item) || 0)
          const explicitStatus = String(item.stockStatus || '').trim().toLowerCase()

          if (explicitStatus === 'low stock') return true
          if (explicitStatus === 'out of stock') return false
          if (minStock > 0) return stock > 0 && stock < minStock
          return maxStock > 0 ? stock < maxStock * 0.5 : false
        })
        .slice(0, 6)
    )

    const recentPurchaseRequests = computed(() =>
      [...purchaseRequests.value]
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 6)
    )

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'code'
      }).format(Number(value || 0))

    const createTimestampLabel = () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}_${hh}-${min}`
    }

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    const buildExportRows = () => {
      const branchRows = branches.value.map((branch) => ({
        section: 'Branches',
        label: `${branch.clinicBranch || 'Branch'}${branch.clinicLocation ? ` - ${branch.clinicLocation}` : ''}`,
        value: formatCurrency(branch.revenue || 0)
      }))

      const appointmentRows = upcomingAppointments.value.length
        ? upcomingAppointments.value.map((appointment) => ({
            section: 'Upcoming Appointments',
            label: appointment.clientName || 'Unknown Client',
            value: `${appointment.date || '-'} ${appointment.time || ''}`.trim()
          }))
        : [{ section: 'Upcoming Appointments', label: 'Status', value: 'No upcoming appointments.' }]

      const transactionRows = recentTransactions.value.length
        ? recentTransactions.value.map((transaction) => ({
            section: 'Recent Transactions',
            label: transaction.clientName || 'Walk-in Client',
            value: formatCurrency(transaction.amount)
          }))
        : [{ section: 'Recent Transactions', label: 'Status', value: 'No transactions yet.' }]

      const lowStockRows = lowStockItems.value.length
        ? lowStockItems.value.map((item) => ({
            section: 'Low Stock Items',
            label: item.name || 'Item',
            value: `${item.currentStock || 0} ${item.unit || 'units'}`
          }))
        : [{ section: 'Low Stock Items', label: 'Status', value: 'No low stock items.' }]

      const requestRows = recentPurchaseRequests.value.length
        ? recentPurchaseRequests.value.map((request) => ({
            section: 'Recent Purchase Requests',
            label: request.item || '-',
            value: request.status || 'Pending'
          }))
        : [{ section: 'Recent Purchase Requests', label: 'Status', value: 'No purchase requests yet.' }]

      return [
        { section: 'Summary', label: 'Total Branches', value: totalBranches.value },
        { section: 'Summary', label: 'Total Employees', value: totalEmployees.value },
        { section: 'Summary', label: 'Total Revenue', value: formatCurrency(monthlyRevenue.value) },
        { section: 'Summary', label: 'Total Clients', value: totalClients.value },
        { section: 'Summary', label: "Today's Appointments", value: todayAppointments.value },
        { section: 'Summary', label: "Today's Revenue", value: formatCurrency(todaysRevenue.value) },
        { section: 'Summary', label: 'Unread Inbox', value: unreadMessages.value },
        { section: 'Summary', label: 'Pending Purchase Requests', value: pendingRequests.value },
        { section: 'Summary', label: 'Low Stock Alerts', value: lowStockCount.value },
        ...branchRows,
        ...appointmentRows,
        ...transactionRows,
        ...lowStockRows,
        ...requestRows
      ]
    }

    const buildDocumentHtml = () => {
      const rows = buildExportRows()
      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.section)}</td>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.value)}</td>
        </tr>
      `).join('')

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Clinic Admin Dashboard Report</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
              h1 { margin: 0 0 6px; font-size: 28px; }
              p { margin: 0 0 18px; color: #4b5563; }
              table { width: 100%; border-collapse: collapse; margin-top: 18px; }
              th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; vertical-align: top; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h1>Clinic Admin Dashboard Report</h1>
            <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Label</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `
    }

    const exportCsv = () => {
      const rows = buildExportRows()
      const csvLines = [
        'Section,Label,Value',
        ...rows.map((row) => [row.section, row.label, row.value]
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(','))
      ]
      downloadBlob(
        new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `clinic-admin-dashboard_${createTimestampLabel()}.csv`
      )
    }

    const exportWord = () => {
      downloadBlob(
        new Blob([buildDocumentHtml()], { type: 'application/msword;charset=utf-8' }),
        `clinic-admin-dashboard_${createTimestampLabel()}.doc`
      )
    }

    const exportPdf = () => {
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) return
      printWindow.document.open()
      printWindow.document.write(buildDocumentHtml())
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }

    return {
      pageLoading,
      loading,
      setupTasks,
      setupCompletedCount,
      setupComplete,
      setupBranch,
      activeSetupBranches,
      selectedSetupBranchId,
      totalBranches,
      totalEmployees,
      monthlyRevenue,
      totalClients,
      todayAppointments,
      unreadMessages,
      todaysRevenue,
      pendingRequests,
      lowStockCount,
      branches,
      staff,
      revenueChartRef,
      employeeChartRef,
      operationsSummary,
      operationsMaximum,
      upcomingAppointments,
      recentTransactions,
      lowStockItems,
      recentPurchaseRequests,
      formatCurrency,
      exportCsv,
      exportWord,
      exportPdf
    }
  }
}
</script>

<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'dashboard', cards: 8, panels: 3 }" class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" :cards="8" :panels="3" />
      <div v-else class="owner-dashboard-shell">
        <section class="dashboard-hero">
          <div class="dashboard-hero-copy">
            <p class="dashboard-kicker">Owner overview</p>
            <h1 class="dashboard-title" data-onboarding-key="owner-dashboard-title">Branch Overview</h1>
            <p class="dashboard-subtitle">Monitor clinic locations, employees, daily operations, and revenue performance in one view.</p>
          </div>

          <div class="dashboard-actions">
            <button
              type="button"
              class="dashboard-action-btn"
              @click="exportCsv"
            >
              Export CSV
            </button>
            <button
              type="button"
              class="dashboard-action-btn"
              @click="exportWord"
            >
              Export Word
            </button>
            <button
              type="button"
              class="dashboard-action-btn dashboard-action-btn-primary"
              @click="exportPdf"
            >
              Export PDF
            </button>
          </div>
        </section>

        <section class="setup-checklist" aria-labelledby="setup-checklist-title">
          <div class="setup-checklist-heading">
            <div>
              <p class="dashboard-kicker">Clinic setup</p>
              <h2 id="setup-checklist-title">{{ setupComplete ? 'You are all set!' : 'Your clinic setup checklist' }}</h2>
              <p>{{ setupComplete ? 'Your essential clinic setup is complete. You can update these settings any time.' : 'Complete these essentials to get your clinic ready for customers.' }}</p>
            </div>
            <div class="setup-progress" :aria-label="`${setupCompletedCount} of ${setupTasks.length} setup tasks complete`">
              <strong>{{ setupCompletedCount }}/{{ setupTasks.length }}</strong><span>complete</span>
            </div>
          </div>
          <label v-if="activeSetupBranches.length > 1" class="setup-branch-picker">Branch
            <select v-model="selectedSetupBranchId">
              <option v-for="branch in activeSetupBranches" :key="branch.id" :value="branch.id">{{ branch.clinicBranch || branch.id }}</option>
            </select>
          </label>
          <p v-else-if="!setupBranch" class="setup-no-branch">Create your clinic branch first to continue setup.</p>
          <ol class="setup-task-list">
            <li v-for="(task, index) in setupTasks" :key="task.key" :class="{ 'is-complete': task.done, 'is-disabled': task.disabled }">
              <span class="setup-task-number" aria-hidden="true">{{ task.done ? '✓' : index + 1 }}</span>
              <div class="setup-task-copy"><h3>{{ task.label }}</h3><p>{{ task.description }}</p></div>
              <RouterLink v-if="!task.done && !task.disabled" :to="task.to" class="setup-task-action">{{ task.action }} <span aria-hidden="true">&gt;</span></RouterLink>
              <span v-else-if="task.done" class="setup-task-status">Done</span>
              <RouterLink v-else-if="task.disabled && task.key !== 'link-policies'" to="/account/subscription" class="setup-task-action">Upgrade Plan to Add</RouterLink>
              <span v-else class="setup-task-status">Create a branch first</span>
            </li>
          </ol>
        </section>

        <section class="dashboard-metrics">
          <article class="metric-card">
            <div class="card-meta-row">
              <span class="metric-pill">Network</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Published clinic locations under your account</span>
              </div>
            </div>
            <p class="metric-label">Total Branches</p>
            <p class="metric-value">{{ totalBranches }}</p>
          </article>

          <article class="metric-card">
            <div class="card-meta-row">
              <span class="metric-pill">Staff</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Active team members across all branches</span>
              </div>
            </div>
            <p class="metric-label">Total Employees</p>
            <p class="metric-value">{{ totalEmployees }}</p>
          </article>

          <article class="metric-card metric-card-accent">
            <div class="card-meta-row">
              <span class="metric-pill">Finance</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Combined recorded branch revenue</span>
              </div>
            </div>
            <p class="metric-label">Total Revenue</p>
            <p class="metric-value">{{ formatCurrency(monthlyRevenue) }}</p>
          </article>

          <article class="metric-card">
            <div class="card-meta-row">
              <span class="metric-pill">Clients</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Customers tracked across your clinics</span>
              </div>
            </div>
            <p class="metric-label">Total Clients</p>
            <p class="metric-value">{{ totalClients }}</p>
          </article>

          <article class="metric-card">
            <div class="card-meta-row">
              <span class="metric-pill">Today</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Scheduled consultations and services today</span>
              </div>
            </div>
            <p class="metric-label">Today's Appointments</p>
            <p class="metric-value">{{ todayAppointments }}</p>
          </article>

          <article class="metric-card metric-card-positive">
            <div class="card-meta-row">
              <span class="metric-pill">Today</span>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Revenue recorded from today's activity</span>
              </div>
            </div>
            <p class="metric-label">Today's Revenue</p>
            <p class="metric-value">{{ formatCurrency(todaysRevenue) }}</p>
          </article>
        </section>

        <section class="dashboard-spotlight-grid">
          <article class="insight-card">
            <div class="card-meta-row">
              <p class="insight-label">Unread Inbox</p>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Messages that still need a response from your side.</span>
              </div>
            </div>
            <p class="insight-value">{{ unreadMessages }}</p>
          </article>

          <article class="insight-card">
            <div class="card-meta-row">
              <p class="insight-label">Pending Purchase Requests</p>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Requests waiting for review or supplier action.</span>
              </div>
            </div>
            <p class="insight-value insight-value-warn">{{ pendingRequests }}</p>
          </article>

          <article class="insight-card">
            <div class="card-meta-row">
              <p class="insight-label">Low Stock Alerts</p>
              <div class="card-info">
                <span class="card-info-trigger" tabindex="0">i</span>
                <span class="card-tooltip">Inventory items that need attention soon.</span>
              </div>
            </div>
            <p class="insight-value insight-value-alert">{{ lowStockCount }}</p>
          </article>
        </section>

        <section class="dashboard-chart-grid">
          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Revenue analytics</p>
                <h2 class="dashboard-card-title">Branch Revenue Performance</h2>
              </div>
            </div>
            <div class="chart-frame">
              <canvas ref="revenueChartRef"></canvas>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Staff breakdown</p>
                <h2 class="dashboard-card-title">Employees by Role</h2>
              </div>
            </div>
            <div class="chart-frame chart-frame-donut">
              <canvas ref="employeeChartRef"></canvas>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Clinic overview</p>
                <h2 class="dashboard-card-title">Appointments & Open Tasks</h2>
              </div>
            </div>
            <div class="chart-frame">
              <div class="operations-bars" role="group" aria-label="Appointment and open task counts">
                <div v-for="item in operationsSummary" :key="item.label" class="operations-bar-row">
                  <div class="operations-bar-label"><span>{{ item.label }}</span><strong>{{ item.count }}</strong></div>
                  <div class="operations-bar-track" aria-hidden="true"><div class="operations-bar-fill" :style="{ width: `${item.count / operationsMaximum * 100}%`, backgroundColor: item.color }"></div></div>
                </div>
              </div>
            </div>
            <p class="operations-chart-note">Appointments are for today. Other counts show currently open items across your branches.</p>
          </article>
        </section>

        <section class="dashboard-content-grid">
          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Schedule pulse</p>
                <h2 class="dashboard-card-title">Upcoming Appointments</h2>
              </div>
            </div>
            <div class="dashboard-list">
              <div
                v-for="appointment in upcomingAppointments"
                :key="appointment.id"
                class="dashboard-list-row"
              >
                <div>
                  <p class="dashboard-list-title">{{ appointment.clientName || 'Unknown Client' }}</p>
                  <p class="dashboard-list-copy">{{ appointment.service || 'Service not set' }}</p>
                </div>
                <p class="dashboard-list-meta">{{ appointment.date }} {{ appointment.time || '' }}</p>
              </div>
              <p v-if="upcomingAppointments.length === 0" class="dashboard-empty">No upcoming appointments.</p>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Cashflow pulse</p>
                <h2 class="dashboard-card-title">Recent Transactions</h2>
              </div>
            </div>
            <div class="dashboard-list">
              <div
                v-for="transaction in recentTransactions"
                :key="transaction.id"
                class="dashboard-list-row"
              >
                <div>
                  <p class="dashboard-list-title">{{ transaction.clientName || 'Walk-in Client' }}</p>
                  <p class="dashboard-list-copy">{{ transaction.method || 'N/A' }}</p>
                </div>
                <p class="dashboard-list-value dashboard-list-value-positive">{{ formatCurrency(transaction.amount) }}</p>
              </div>
              <p v-if="recentTransactions.length === 0" class="dashboard-empty">No transactions yet.</p>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Inventory watch</p>
                <h2 class="dashboard-card-title">Low Stock Items</h2>
              </div>
            </div>
            <div class="dashboard-list">
              <div
                v-for="item in lowStockItems"
                :key="item.id"
                class="dashboard-list-row"
              >
                <div>
                  <p class="dashboard-list-title">{{ item.name }}</p>
                  <p class="dashboard-list-copy">{{ item.supplier || '-' }}</p>
                </div>
                <p class="dashboard-list-value dashboard-list-value-alert">
                  {{ item.currentStock || 0 }} {{ item.unit || 'units' }}
                </p>
              </div>
              <p v-if="lowStockItems.length === 0" class="dashboard-empty">No low stock items.</p>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <p class="dashboard-card-kicker">Operations queue</p>
                <h2 class="dashboard-card-title">Recent Purchase Requests</h2>
              </div>
            </div>
            <div class="dashboard-list">
              <div
                v-for="request in recentPurchaseRequests"
                :key="request.id"
                class="dashboard-list-row"
              >
                <div>
                  <p class="dashboard-list-title">{{ request.item || '-' }}</p>
                  <p class="dashboard-list-copy">{{ request.supplier || '-' }}</p>
                </div>
                <span
                  :class="[
                    'dashboard-status-pill',
                    String(request.status || 'Pending').toLowerCase() === 'pending'
                      ? 'dashboard-status-pending'
                      : String(request.status || '').toLowerCase() === 'delivered'
                        ? 'dashboard-status-delivered'
                        : 'dashboard-status-neutral'
                  ]"
                >
                  {{ request.status || 'Pending' }}
                </span>
              </div>
              <p v-if="recentPurchaseRequests.length === 0" class="dashboard-empty">No purchase requests yet.</p>
            </div>
          </article>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.operations-bars { display: grid; align-content: center; gap: 20px; height: 100%; padding: 18px 16px; }
.operations-bar-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 12px; line-height: 1.4; color: #624733; }
.operations-bar-label strong { flex-shrink: 0; font-size: 15px; font-variant-numeric: tabular-nums; color: #342419; }
.operations-bar-track { height: 9px; background: #f0e1ce; border-radius: 999px; overflow: hidden; }
.operations-bar-fill { height: 100%; border-radius: inherit; }
.operations-chart-note { margin-top: 12px; color: #786354; font-size: 11px; line-height: 1.6; }
.owner-dashboard-shell {
  display: grid;
  gap: 1.35rem;
}

.dashboard-hero {
  display: grid;
  gap: 1rem;
  align-items: end;
  border: 1px solid rgba(123, 79, 55, 0.34);
  border-radius: 1.75rem;
  background:
    radial-gradient(circle at top right, rgba(230, 193, 150, 0.12), transparent 24%),
    linear-gradient(180deg, rgba(47, 31, 21, 0.94), rgba(27, 17, 12, 0.96));
  padding: 1.35rem;
  box-shadow: 0 24px 56px rgba(11, 6, 4, 0.24);
}

.dashboard-kicker,
.dashboard-card-kicker {
  margin: 0 0 0.45rem;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: #d4ae8b;
}

.dashboard-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 0.94;
  letter-spacing: -0.04em;
  color: #fff0e1;
}

.dashboard-subtitle {
  margin: 0.7rem 0 0;
  max-width: 44rem;
  color: #d4bead;
  line-height: 1.6;
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.dashboard-action-btn {
  border-radius: 1rem;
  border: 1px solid rgba(123, 79, 55, 0.44);
  background: rgba(43, 28, 19, 0.82);
  color: #f2e2d2;
  padding: 0.9rem 1.1rem;
  font-size: 0.88rem;
  font-weight: 700;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.dashboard-action-btn:hover {
  background: rgba(67, 43, 29, 0.92);
  transform: translateY(-1px);
}

.dashboard-action-btn-primary {
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  border-color: rgba(214, 169, 123, 0.45);
  color: #fff7ef;
}

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1rem;
}

.metric-card {
  position: relative;
  border: 1px solid rgba(123, 79, 55, 0.34);
  border-radius: 1.5rem;
  background:
    linear-gradient(180deg, rgba(48, 31, 21, 0.94), rgba(31, 20, 14, 0.96));
  padding: 1rem 1rem 0.95rem;
  box-shadow: 0 18px 42px rgba(11, 6, 4, 0.2);
}

.metric-card-accent {
  background:
    radial-gradient(circle at top right, rgba(241, 212, 170, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(74, 47, 31, 0.98), rgba(44, 28, 20, 0.98));
}

.metric-card-positive {
  background:
    radial-gradient(circle at top right, rgba(36, 168, 114, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(38, 48, 36, 0.98), rgba(23, 31, 24, 0.98));
}

.metric-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.3rem 0.62rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(214, 169, 123, 0.12);
  color: #d7b08a;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-weight: 700;
}

.card-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.card-info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.card-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  border: 1px solid rgba(214, 169, 123, 0.2);
  background: rgba(255, 255, 255, 0.04);
  color: #d8b38f;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  user-select: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.card-info:hover .card-info-trigger,
.card-info:focus-within .card-info-trigger {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(214, 169, 123, 0.34);
  color: #f2dcc4;
}

.card-tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 0.6rem);
  width: min(220px, 52vw);
  border-radius: 0.9rem;
  border: 1px solid rgba(123, 79, 55, 0.48);
  background: linear-gradient(180deg, rgba(50, 32, 22, 0.98), rgba(30, 18, 12, 0.98));
  box-shadow: 0 16px 34px rgba(7, 4, 3, 0.34);
  padding: 0.7rem 0.8rem;
  color: #ead8ca;
  font-size: 0.74rem;
  line-height: 1.45;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 12;
}

.card-info:hover .card-tooltip,
.card-info:focus-within .card-tooltip {
  opacity: 1;
  transform: translateY(0);
}

.metric-label {
  margin: 0.8rem 0 0;
  color: #d4bead;
  font-size: 0.82rem;
}

.metric-value {
  margin: 0.5rem 0 0;
  color: #fff1e3;
  font-size: clamp(1.45rem, 2.2vw, 2.1rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  word-break: break-word;
}

.dashboard-spotlight-grid,
.dashboard-chart-grid,
.dashboard-content-grid {
  display: grid;
  gap: 1rem;
}

.insight-card,
.dashboard-card {
  position: relative;
  border-radius: 1.5rem;
  border: 1px solid rgba(123, 79, 55, 0.34);
  background:
    linear-gradient(180deg, rgba(44, 29, 20, 0.94), rgba(31, 20, 14, 0.96));
  box-shadow: 0 18px 42px rgba(11, 6, 4, 0.2);
}

.insight-card {
  padding: 1.15rem 1.2rem;
}

.insight-label {
  margin: 0;
  color: #d4bead;
  font-size: 0.88rem;
}

.insight-value {
  margin: 0.55rem 0 0;
  color: #fff0e1;
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1;
}

.insight-value-warn {
  color: #ffd17f;
}

.insight-value-alert {
  color: #f7c269;
}

.dashboard-card {
  padding: 1.25rem;
}

.dashboard-card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dashboard-card-title {
  margin: 0;
  color: #fff1e3;
  font-size: 1.35rem;
  font-weight: 700;
}

.chart-frame {
  height: 320px;
  border-radius: 1.15rem;
  border: 1px solid rgba(123, 79, 55, 0.26);
  background: rgba(255, 255, 255, 0.02);
  padding: 1rem;
}

.chart-frame-donut {
  height: 320px;
}

.dashboard-list {
  display: grid;
  gap: 0.75rem;
}

.dashboard-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(123, 79, 55, 0.24);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.95rem 1rem;
}

.dashboard-list-title {
  margin: 0;
  color: #fff0e1;
  font-size: 0.92rem;
  font-weight: 700;
}

.dashboard-list-copy {
  margin: 0.3rem 0 0;
  color: #cbb19c;
  font-size: 0.8rem;
}

.dashboard-list-meta,
.dashboard-list-value {
  color: #ead9ca;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: right;
}

.dashboard-list-value-positive {
  color: #97f1c6;
}

.dashboard-list-value-alert {
  color: #ffd17f;
}

.dashboard-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.38rem 0.68rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dashboard-status-pending {
  background: rgba(245, 158, 11, 0.14);
  color: #ffd38d;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.dashboard-status-delivered {
  background: rgba(52, 211, 153, 0.14);
  color: #aff5d5;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.dashboard-status-neutral {
  background: rgba(255, 255, 255, 0.08);
  color: #e8d8cf;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dashboard-empty {
  margin: 0;
  color: #bca28e;
  font-size: 0.86rem;
}

/* Owner workspaces use the landing page's warm cream surfaces. These rules
   deliberately sit after the original dashboard definitions so every card,
   chart frame, tooltip, and data row follows the same visual system. */
.dashboard-hero {
  border-color: #e6c196;
  background: radial-gradient(circle at top right, rgba(230, 193, 150, .46), transparent 30%), linear-gradient(145deg, #fffdf9, #fff8eb 64%, #f8e5bd);
  box-shadow: 0 20px 48px rgba(72, 42, 23, .12);
}
.dashboard-kicker, .dashboard-card-kicker { color: #956344; }
.dashboard-title, .dashboard-card-title, .metric-value, .insight-value, .dashboard-list-title { color: #342419; }
.dashboard-subtitle, .metric-label, .insight-label, .dashboard-list-copy, .dashboard-list-meta, .dashboard-list-value, .dashboard-empty { color: #624733; }
.dashboard-action-btn { border-color: #cf9f78; background: #fffdf9; color: #7b4f37; }
.dashboard-action-btn:hover { background: #f8e5bd; }
.dashboard-action-btn-primary { border-color: #956344; background: #956344; color: #fffaf3; }
.metric-card, .insight-card, .dashboard-card { border-color: #ead2b2; background: linear-gradient(180deg, #fffdf9, #fff8eb); box-shadow: 0 14px 34px rgba(72, 42, 23, .08); }
.metric-card-accent { background: radial-gradient(circle at top right, rgba(241, 212, 170, .52), transparent 30%), linear-gradient(180deg, #fffdf9, #fff8eb); }
.metric-card-positive { background: radial-gradient(circle at top right, rgba(57, 115, 74, .16), transparent 28%), linear-gradient(180deg, #fffdf9, #fff8eb); }
.metric-pill { border-color: #e6c196; background: #f8ead4; color: #956344; }
.card-info-trigger { border-color: #e6c196; background: #fff8eb; color: #956344; }
.card-info:hover .card-info-trigger, .card-info:focus-within .card-info-trigger { border-color: #cf9f78; background: #f8e5bd; color: #7b4f37; }
.card-tooltip { border-color: #e6c196; background: linear-gradient(145deg, #fffdf9, #fdf3e2); box-shadow: 0 16px 34px rgba(72, 42, 23, .16); color: #473223; }
.chart-frame { border-color: #ead2b2; background: #fffaf4; }
.dashboard-list-row { border-color: #ead2b2; background: #fffaf4; }
.insight-value-warn, .dashboard-list-value-alert { color: #8a5b18; }
.insight-value-alert { color: #a13f38; }
.dashboard-list-value-positive { color: #39734a; }
.dashboard-status-neutral { border-color: #ead2b2; background: #fff7ec; color: #624733; }

/* Dashboards are visual summaries. The detailed source data remains available
   in its dedicated modules and exports, while this page focuses on charts. */
.dashboard-metrics,
.dashboard-spotlight-grid,
.dashboard-content-grid { display: none; }

.setup-checklist { padding: 1.5rem; border: 1px solid #ead2b2; border-radius: 1.5rem; background: linear-gradient(180deg, #fffdf9, #fff8eb); box-shadow: 0 14px 34px rgba(72, 42, 23, .08); }
.setup-checklist-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.setup-checklist-heading h2 { margin: 0; color: #342419; font-size: clamp(1.4rem, 3vw, 1.9rem); font-weight: 750; }
.setup-checklist-heading p:last-child { max-width: 42rem; margin: .5rem 0 0; color: #624733; line-height: 1.55; }
.setup-progress { display: grid; justify-items: center; min-width: 4.5rem; padding: .7rem; border: 1px solid #e6c196; border-radius: 1rem; background: #f8ead4; color: #7b4f37; }
.setup-progress strong { font-size: 1.2rem; }
.setup-progress span { font-size: .68rem; }
.setup-branch-picker { display: grid; gap: .45rem; max-width: 22rem; margin-top: 1.25rem; color: #624733; font-size: .82rem; font-weight: 650; }
.setup-branch-picker select { min-height: 2.7rem; padding: .5rem .7rem; border: 1px solid #dec19e; border-radius: .7rem; background: #fffaf4; color: #342419; }
.setup-no-branch { margin: 1rem 0 0; color: #8a5b18; font-size: .85rem; }
.setup-task-list { display: grid; gap: .65rem; margin: 1.2rem 0 0; padding: 0; list-style: none; }
.setup-task-list li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .85rem; padding: .9rem; border: 1px solid #ead2b2; border-radius: 1rem; background: #fffaf4; }
.setup-task-list li.is-complete { border-color: #c7dcc7; background: #f5faf2; }
.setup-task-list li.is-disabled { opacity: .82; }
.setup-task-number { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid #dec19e; border-radius: 50%; color: #956344; font-size: .82rem; font-weight: 750; }
.is-complete .setup-task-number { border-color: #39734a; background: #39734a; color: white; }
.setup-task-copy h3 { margin: 0; color: #342419; font-size: .92rem; font-weight: 700; }
.setup-task-copy p { margin: .2rem 0 0; color: #786354; font-size: .78rem; line-height: 1.45; }
.setup-task-action, .setup-task-status { justify-self: end; color: #7b4f37; font-size: .78rem; font-weight: 700; text-align: right; white-space: nowrap; }
.setup-task-action:hover { color: #39734a; text-decoration: underline; }
.setup-task-status { color: #39734a; }

@media (max-width: 620px) {
  .setup-checklist { padding: 1rem; }
  .setup-task-list li { grid-template-columns: auto minmax(0, 1fr); }
  .setup-task-action, .setup-task-status { grid-column: 2; justify-self: start; text-align: left; }
}

@media (min-width: 1280px) {
  .dashboard-chart-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 768px) {
  .dashboard-hero {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .dashboard-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-spotlight-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-chart-grid,
  .dashboard-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .dashboard-metrics {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .metric-card {
    min-height: 190px;
  }
}
</style>
