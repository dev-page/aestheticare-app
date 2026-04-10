<script>
import { ref, onMounted, nextTick, computed } from 'vue'
import { auth } from '@/config/firebaseConfig'
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'

export default {
  name: 'OwnerDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const loading = ref(true)

    const totalBranches = ref(0)
    const totalEmployees = ref(0)
    const monthlyRevenue = ref(0)
    const totalClients = ref(0)
    const todayAppointments = ref(0)
    const unreadMessages = ref(0)
    const todaysRevenue = ref(0)
    const pendingRequests = ref(0)
    const lowStockCount = ref(0)

    const branches = ref([])
    const staff = ref([])
    const appointments = ref([])
    const transactions = ref([])
    const inventoryItems = ref([])
    const purchaseRequests = ref([])
    const messages = ref([])

    const revenueChartRef = ref(null)
    const employeeChartRef = ref(null)
    let revenueChartInstance = null
    let employeeChartInstance = null
    let chartModulePromise = null
    let chartModule = null

    const loadChartModule = async () => {
      if (chartModule) return chartModule
      if (!chartModulePromise) {
        chartModulePromise = import('chart.js').then((module) => {
          chartModule = module
          chartModule.Chart.register(...module.registerables)
          return module
        })
      }
      return chartModulePromise
    }

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const fetchByBranchIds = async (collectionName, branchIds) => {
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
    }

    const toTimestampDate = (value) => (value?.toDate ? value.toDate() : null)
    const todayKey = () => {
      const today = new Date()
      const month = `${today.getMonth() + 1}`.padStart(2, '0')
      const day = `${today.getDate()}`.padStart(2, '0')
      return `${today.getFullYear()}-${month}-${day}`
    }

    const getEffectiveMaxStock = (item) => {
      const explicitMax = Number(item.maxStock || 0)
      if (explicitMax > 0) return explicitMax
      return Number(item.currentStock || 0)
    }

    const loadDashboardData = async () => {
      loading.value = true
      try {
        const user = auth.currentUser
        if (!user) return

        const branchQuery = query(
          collection(db, "clinics"),
          where("ownerId", "==", user.uid)
        )

        const branchSnapshot = await getDocs(branchQuery)
        const branchData = branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        branches.value = branchData
        totalBranches.value = branches.value.length

        const branchIds = branches.value.map(b => b.id)

        let staffData = []
        if (branchIds.length) {
          const chunks = chunkArray(branchIds)
          for (const chunk of chunks) {
            const staffQuery = query(
              collection(db, "users"),
              where("branchId", "in", chunk),
              where("userType", "==", "Staff")
            )
            const staffSnapshot = await getDocs(staffQuery)
            staffData = staffData.concat(
              staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            )
          }
          staffData = staffData.filter((u) => !u.archived)
        }

        staff.value = staffData
        totalEmployees.value = staff.value.length

        const [clientsData, appointmentsData, transactionsData, inventoryData, purchaseRequestData, messageData] = await Promise.all([
          fetchByBranchIds('clients', branchIds),
          fetchByBranchIds('appointments', branchIds),
          fetchByBranchIds('transactions', branchIds),
          fetchByBranchIds('inventoryItems', branchIds),
          fetchByBranchIds('purchaseRequests', branchIds),
          fetchByBranchIds('messages', branchIds)
        ])

        appointments.value = appointmentsData
        transactions.value = transactionsData
        inventoryItems.value = inventoryData
        purchaseRequests.value = purchaseRequestData
        messages.value = messageData

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

          return isToday ? sum + Number(entry.amount || 0) : sum
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

        monthlyRevenue.value = branches.value.reduce((sum, b) => sum + (b.revenue || 0), 0)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        loading.value = false
        await nextTick()
        renderRevenueChart()
        if (branches.value.length > 0) {
          renderEmployeeChart()
        }
      }
    }
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
              color: '#f7e8de',
              font: { size: 16, weight: '700' },
              padding: { bottom: 16 }
            },
            legend: {
              labels: {
                color: '#e7d4c5',
                boxWidth: 14,
                boxHeight: 14
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#d7c0ad' },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#d7c0ad' },
              grid: { color: 'rgba(241,212,170,0.1)' }
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
          color: '#f7e8de',
          font: { size: 16, weight: '700' },
          padding: { bottom: 16 }
        },
        legend: {
          position: 'top',
          labels: {
            color: '#e7d4c5',
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

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return
        await loadChartModule()
        await loadDashboardData()
      })
    })

    const upcomingAppointments = computed(() =>
      [...appointments.value]
        .filter((item) => (item.date || '') >= todayKey())
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
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
      loading,
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

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else class="owner-dashboard-shell">
        <section class="dashboard-hero">
          <div class="dashboard-hero-copy">
            <p class="dashboard-kicker">Owner overview</p>
            <h1 class="dashboard-title">Branch Overview</h1>
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
