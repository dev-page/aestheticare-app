<script setup>
defineProps({
  variant: { type: String, default: 'table' },
  columns: { type: Number, default: 5 },
  rows: { type: Number, default: 5 },
  cards: { type: Number, default: 4 },
  fields: { type: Number, default: 6 },
  sections: { type: Number, default: 2 },
  panels: { type: Number, default: 2 },
  listPanels: { type: Number, default: 2 },
  header: { type: Boolean, default: true },
  blocks: { type: Array, default: () => [] },
  cardStyle: { type: String, default: 'catalog' },
})
</script>

<template>
  <div class="page-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading page content…</span>
    <div aria-hidden="true" class="skeleton-layout">
      <div v-if="header" class="skeleton-heading"><div class="bone title"></div><div class="bone subtitle"></div></div>
      <template v-if="blocks.length">
        <PageSkeleton v-for="(block, index) in blocks" :key="index" v-bind="block" :header="false" />
      </template>
      <template v-else>
      <template v-if="variant === 'discovery'">
        <div class="discovery-hero-skeleton">
          <div class="bone title"></div>
          <div class="bone subtitle"></div>
        </div>
        <div class="skeleton-surface discovery-filters">
          <div class="discovery-filter-grid"><div v-for="filter in 4" :key="filter" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div>
          <div class="discovery-filter-grid secondary"><div v-for="filter in 3" :key="filter" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div><div class="bone button"></div></div>
        </div>
        <div class="skeleton-section-heading"><div class="bone medium"></div><div class="bone short"></div></div>
        <div class="skeleton-cards discovery-cards" :style="{ '--cards': Math.min(cards, 3) }">
          <div v-for="card in cards" :key="card" class="skeleton-surface discovery-card">
            <div class="bone card-image"></div><div class="bone medium"></div><div class="bone subtitle"></div><div class="bone short"></div><div class="bone button"></div>
          </div>
        </div>
      </template>
      <template v-else-if="variant === 'calendar-dashboard'">
        <div class="skeleton-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 3" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="skeleton-surface schedule-summary"><div class="bone medium"></div><div class="schedule-summary-grid"><div class="bone schedule-card"></div><div class="bone schedule-card"></div></div></div>
        <div class="calendar-dashboard-grid">
          <div class="skeleton-surface calendar-skeleton">
            <div class="calendar-toolbar"><div class="bone button"></div><div class="bone medium"></div><div class="bone button"></div></div>
            <div class="calendar-weekdays"><div v-for="day in 7" :key="day" class="bone short"></div></div>
            <div class="calendar-month-grid"><div v-for="day in 35" :key="day" class="calendar-day"><div class="bone short"></div><div v-if="day % 4 === 0" class="bone calendar-event"></div></div></div>
          </div>
          <div class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 5" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div>
        </div>
      </template>
      <template v-else-if="variant === 'weekly-schedule'">
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-fields schedule-fields"><div v-for="field in 3" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div></div>
        <div class="skeleton-surface weekly-schedule-panel"><div class="bone medium"></div><div v-for="day in 7" :key="day" class="weekly-schedule-row"><div class="bone medium"></div><div class="bone schedule-toggle"></div><div class="bone input"></div><div class="bone input"></div></div><div class="bone button schedule-save"></div></div>
      </template>
      <template v-else-if="variant === 'shift-assignment'">
        <div class="shift-assignment-grid"><div class="skeleton-surface"><div class="bone medium"></div><div v-for="field in 4" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div><div class="skeleton-surface shift-guidance"><div class="bone medium"></div><div v-for="line in 4" :key="line" class="bone subtitle"></div></div></div><div class="skeleton-surface weekly-schedule-panel"><div class="skeleton-section-heading"><div><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="hero-actions"><div class="bone button"></div><div class="bone button"></div></div></div><div v-for="day in 7" :key="day" class="weekly-schedule-row"><div class="bone medium"></div><div class="bone schedule-toggle"></div><div class="bone input"></div><div class="bone input"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'pharmacy-pos'">
        <div class="pharmacy-pos-grid">
          <div class="skeleton-surface"><div class="skeleton-toolbar"><div class="bone medium"></div><div class="bone search"></div></div><div class="pharmacy-items-grid"><div v-for="item in 6" :key="item" class="pharmacy-item"><div class="bone medium"></div><div class="bone subtitle"></div><div class="bone short"></div><div class="bone button"></div></div></div></div>
          <div class="skeleton-surface pharmacy-cart"><div class="bone medium"></div><div v-for="item in 3" :key="item" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div><div class="bone short"></div></div><div v-for="field in 2" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div><div class="bone button"></div></div>
        </div>
        <div class="skeleton-panels" :style="{ '--panels': 2 }"><div v-for="panel in 2" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 3" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'prescriptions'">
        <div class="prescription-filter skeleton-surface"><div class="bone medium"></div><div class="bone input"></div></div>
        <div class="prescription-card-grid"><div v-for="card in rows" :key="card" class="skeleton-surface prescription-card-skeleton"><div class="prescription-card-head"><div><div class="bone short"></div><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button small"></div></div><div class="prescription-detail-skeleton"><div class="bone medium"></div><div v-for="line in 3" :key="line" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div><div class="prescription-footer-skeleton"><div class="bone subtitle"></div><div class="bone button"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'clinic-branch-profile'">
        <div class="skeleton-surface clinic-branch-banner"><div class="bone clinic-avatar"></div><div class="bone clinic-branch-name"></div><div class="bone button"></div></div>
        <div class="appointment-tabs-skeleton"><div v-for="tab in 5" :key="tab" class="bone tab"></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-fields"><div v-for="field in 6" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div></div>
        <div class="skeleton-surface map-skeleton"><div class="bone medium"></div><div class="bone map-placeholder"></div></div>
      </template>
      <template v-else-if="variant === 'clinic-profile'">
        <div class="skeleton-surface"><div class="bone medium"></div><div class="clinic-banner-placeholder"></div><div class="clinic-brand-row"><div class="bone clinic-avatar"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button"></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-fields"><div v-for="field in 5" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div></div>
        <div class="skeleton-surface map-skeleton"><div class="bone medium"></div><div class="bone map-placeholder"></div></div>
      </template>
      <template v-else-if="variant === 'center-profile'">
        <div class="center-profile-banner"><div class="bone center-profile-avatar"></div><div class="skeleton-copy"><div class="bone title"></div><div class="bone subtitle"></div></div></div>
        <div class="appointment-tabs-skeleton"><div v-for="tab in 4" :key="tab" class="bone tab"></div></div>
        <div class="center-profile-panels"><div class="skeleton-surface"><div class="bone medium"></div><div class="bone subtitle"></div><div class="bone subtitle"></div><div class="bone short"></div></div><div class="skeleton-surface map-skeleton"><div class="bone medium"></div><div class="bone map-placeholder"></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-cards discovery-cards" :style="{ '--cards': 3 }"><div v-for="card in 3" :key="card" class="skeleton-surface"><div class="bone card-image"></div><div class="bone medium"></div><div class="bone subtitle"></div><div class="bone button"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'employee-profile'">
        <div class="employee-profile-skeleton"><div class="skeleton-surface employee-identity-skeleton"><div class="bone avatar"></div><div class="bone button"></div><div class="bone medium"></div><div class="bone subtitle"></div><div v-for="detail in 3" :key="detail" class="skeleton-surface"><div class="bone short"></div><div class="bone medium"></div></div></div><div class="skeleton-surface"><div class="skeleton-fields"><div v-for="field in 7" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div><div class="bone button"></div></div></div>
      </template>
      <template v-else-if="variant === 'checkout'">
        <div class="checkout-skeleton-grid"><div class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 3" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div><div class="bone short"></div></div></div><div class="skeleton-surface checkout-summary-skeleton"><div class="bone medium"></div><div v-for="line in 4" :key="line" class="summary-skeleton-row"><div class="bone medium"></div><div class="bone short"></div></div><div class="bone button"></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-fields"><div v-for="field in 6" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-summary-grid" :style="{ '--cards': 2 }"><div v-for="method in 2" :key="method" class="skeleton-surface"><div class="bone short"></div><div class="bone medium"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'appointments'">
        <div class="appointment-tabs-skeleton"><div v-for="tab in 4" :key="tab" class="bone tab"></div></div>
        <div class="skeleton-surface"><div class="skeleton-section-heading"><div class="bone medium"></div><div class="bone short"></div></div><div class="skeleton-toolbar appointment-toolbar"><div class="bone search"></div><div class="bone input"></div><div class="bone input"></div></div><div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': 6 }"><div v-for="row in rows + 1" :key="row" class="skeleton-table-row"><div v-for="column in 6" :key="column" class="bone" :class="column === 1 ? 'medium' : column === 6 ? 'short' : ''"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'appointment-cards'">
        <div class="skeleton-surface"><div class="skeleton-section-heading"><div class="bone medium"></div><div class="bone short"></div></div><div class="appointment-card-grid"><div v-for="card in 3" :key="card" class="skeleton-surface appointment-card"><div class="prescription-card-head"><div><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button small"></div></div><div class="appointment-detail-grid"><div v-for="detail in 3" :key="detail"><div class="bone short"></div><div class="bone medium"></div></div></div><div class="skeleton-surface appointment-price-details"><div class="bone medium"></div><div v-for="line in 4" :key="line" class="skeleton-list-row"><div class="bone medium"></div><div class="bone short"></div></div></div><div class="prescription-footer-skeleton"><div class="bone subtitle"></div><div class="bone button"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'role-management'">
        <div class="skeleton-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 3" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="skeleton-surface"><div class="appointment-tabs-skeleton"><div v-for="tab in 4" :key="tab" class="bone tab"></div></div><div class="role-editor-grid"><div class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 5" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div><div class="skeleton-surface"><div class="bone medium"></div><div v-for="field in 4" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'attendance'">
        <div class="skeleton-summary-grid" :style="{ '--cards': 4 }"><div v-for="card in 4" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="appointment-tabs-skeleton"><div v-for="tab in 4" :key="tab" class="bone tab"></div></div>
        <div class="skeleton-surface"><div class="refunds-filters attendance-filters"><div v-for="filter in 3" :key="filter" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div><div class="skeleton-section-heading"><div class="bone medium"></div><div class="bone button"></div></div><div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': 7 }"><div v-for="row in rows + 1" :key="row" class="skeleton-table-row"><div v-for="column in 7" :key="column" class="bone"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'detail'">
        <div class="skeleton-surface detail-selector"><div class="bone short"></div><div class="bone input"></div></div>
        <div class="skeleton-surface payslip-skeleton"><div class="payslip-heading"><div><div class="bone medium"></div><div class="bone short"></div></div><div class="payslip-meta"><div v-for="line in 3" :key="line" class="bone short"></div></div></div><div class="payslip-columns"><div v-for="column in 2" :key="column" class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 4" :key="row" class="skeleton-list-row"><div class="bone medium"></div><div class="bone short"></div></div></div></div><div class="payslip-totals"><div v-for="total in 3" :key="total"><div class="bone short"></div><div class="bone medium"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'refunds'">
        <div class="refunds-filters skeleton-surface"><div v-for="filter in 4" :key="filter" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div>
        <div class="refunds-layout"><div class="refunds-tables"><div v-for="table in 2" :key="table" class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': table === 1 ? 8 : 7 }"><div v-for="row in 5" :key="row" class="skeleton-table-row"><div v-for="column in (table === 1 ? 8 : 7)" :key="column" class="bone" :class="column === 1 ? 'medium' : ''"></div></div></div></div></div></div><div class="skeleton-surface"><div class="bone medium"></div><div v-for="line in 6" :key="line" class="bone input"></div><div class="bone button"></div></div></div>
      </template>
      <template v-else-if="variant === 'subscription'">
        <div class="subscription-plan-skeleton"><div v-for="card in 2" :key="card" class="skeleton-surface"><div class="bone short"></div><div class="bone medium"></div><div class="bone value"></div><div v-for="line in 4" :key="line" class="bone"></div><div class="bone button"></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': 5 }"><div v-for="row in 4" :key="row" class="skeleton-table-row"><div v-for="column in 5" :key="column" class="bone"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'summary'">
        <div class="skeleton-surface summary-skeleton"><div class="bone medium"></div><div v-for="row in rows" :key="row" class="summary-skeleton-row"><div class="bone medium"></div><div class="bone short"></div></div></div>
      </template>
      <template v-else-if="variant === 'charts'">
        <div class="skeleton-panels" :style="{ '--panels': panels }"><div v-for="panel in panels" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div class="chart-placeholder"><div v-for="bar in 5" :key="bar" class="bone chart-bar" :style="{ height: `${25 + (bar * 17 % 65)}%` }"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'owner-dashboard'">
        <div class="owner-dashboard-hero skeleton-surface"><div><div class="bone short"></div><div class="bone title"></div><div class="bone subtitle"></div></div><div class="hero-actions"><div v-for="button in 3" :key="button" class="bone button"></div></div></div>
        <div class="skeleton-surface"><div class="skeleton-section-heading"><div><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone value"></div></div><div v-for="row in 5" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button small"></div></div></div>
        <div class="skeleton-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 6" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone medium"></div><div class="bone value"></div></div></div>
        <div class="skeleton-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 3" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="skeleton-panels" :style="{ '--panels': 2 }"><div v-for="panel in 4" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div class="chart-placeholder"><div v-for="bar in 5" :key="bar" class="bone chart-bar" :style="{ height: `${25 + (bar * 17 % 65)}%` }"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'manager-dashboard' || variant === 'receptionist-dashboard'">
        <div class="skeleton-summary-grid" :style="{ '--cards': 4 }"><div v-for="card in 4" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="skeleton-surface schedule-summary"><div class="bone medium"></div><div class="schedule-summary-grid"><div class="bone schedule-card"></div><div class="bone schedule-card"></div></div></div>
        <div v-if="variant === 'manager-dashboard'" class="skeleton-panels" :style="{ '--panels': 2 }"><div v-for="panel in 2" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div class="chart-placeholder"><div v-for="bar in 5" :key="bar" class="bone chart-bar" :style="{ height: `${25 + (bar * 17 % 65)}%` }"></div></div></div></div>
        <div class="skeleton-panels" :style="{ '--panels': 2 }"><div v-for="panel in 2" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 5" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone short"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'superadmin-dashboard'">
        <div class="skeleton-summary-grid superadmin-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 5" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone value"></div></div></div>
        <div class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 3" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone input"></div></div></div></div>
      </template>
      <template v-else-if="variant === 'employee-dashboard'">
        <div class="skeleton-surface"><div class="bone short"></div><div class="bone title"></div><div class="bone subtitle"></div></div>
        <div class="skeleton-summary-grid" :style="{ '--cards': 3 }"><div v-for="card in 3" :key="card" class="skeleton-surface stat"><div class="bone short"></div><div class="bone medium"></div><div class="bone subtitle"></div></div></div>
        <div class="skeleton-panels" :style="{ '--panels': 2 }"><div v-for="panel in 3" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 4" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div></div></div></div>
      </template>
      <template v-else-if="variant === 'dashboard' || variant === 'cards' || variant === 'report'">
        <div v-if="variant === 'cards' && cardStyle === 'catalog'" class="skeleton-toolbar"><div class="bone search"></div><div class="bone button"></div></div>
        <div class="skeleton-cards" :style="{ '--cards': Math.min(cards, 4) }">
          <div v-for="card in cards" :key="card" class="skeleton-surface stat">
            <div v-if="variant === 'cards' && cardStyle === 'catalog'" class="bone card-image"></div>
            <div class="bone short"></div><div class="bone value"></div><div class="bone medium"></div>
            <template v-if="variant === 'cards' && cardStyle === 'plan'"><div v-for="line in 5" :key="line" class="bone"></div><div class="bone button"></div></template>
          </div>
        </div>
      </template>
      <div v-if="variant === 'dashboard' || variant === 'report'" class="skeleton-panels" :style="{ '--panels': panels }">
        <div v-for="panel in panels" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div class="chart-placeholder"><div v-for="bar in 5" :key="bar" class="bone chart-bar" :style="{ height: `${25 + (bar * 17 % 65)}%` }"></div></div></div>
      </div>
      <div v-if="variant === 'form' || variant === 'profile' || variant === 'settings'" class="skeleton-surface skeleton-form" :class="{ 'profile-form': variant === 'profile' }">
        <div v-if="variant === 'profile'" class="bone avatar"></div>
        <section v-for="section in sections" :key="section" class="skeleton-form-section">
          <div class="bone medium"></div>
          <div class="skeleton-fields"><div v-for="field in fields" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div>
        </section>
        <div class="bone button"></div>
      </div>
      <div v-else-if="variant === 'split' || variant === 'chat'" class="skeleton-split">
        <div class="skeleton-surface"><div class="bone input"></div><div v-for="row in rows" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div>
        <div class="skeleton-surface split-detail"><div class="bone medium"></div><div v-for="row in 4" :key="row" class="bone message" :class="{ reply: row % 2 === 0 }"></div><div class="bone input composer"></div></div>
      </div>
      <div v-else-if="variant === 'list'" class="skeleton-surface"><div v-for="row in rows" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button small"></div></div></div>
      <div v-else-if="variant !== 'cards'" class="skeleton-surface">
        <div class="skeleton-toolbar"><div class="bone search"></div><div class="bone button"></div></div>
        <div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': columns }"><div v-for="row in rows + 1" :key="row" class="skeleton-table-row"><div v-for="column in columns" :key="column" class="bone" :class="column === columns ? 'short' : ''"></div></div></div></div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page-skeleton { width: 100%; color: var(--ac-text-muted); }
.skeleton-layout { display: grid; gap: 24px; }
.skeleton-heading, .skeleton-copy { display: grid; gap: 12px; }
.bone { height: 12px; max-width: 100%; border-radius: 6px; background: linear-gradient(100deg, var(--ac-surface-muted) 20%, var(--ac-border) 45%, var(--ac-surface-muted) 70%); background-size: 240% 100%; animation: skeleton-shimmer 1.7s ease-in-out infinite; }
.title { height: 28px; width: 260px; }
.subtitle { width: 380px; }
.short { width: 72px; }
.medium { width: 160px; }
.value { height: 30px; width: 90px; }
.skeleton-surface { padding: 24px; border-radius: 16px; border: 1px solid var(--ac-border); background: var(--ac-surface); min-width: 0; }
.skeleton-cards { display: grid; grid-template-columns: repeat(var(--cards), minmax(0, 1fr)); gap: 16px; }
.stat { display: grid; gap: 18px; }
.card-image { height: 140px; width: 100%; border-radius: 10px; }
.skeleton-panels { display: grid; grid-template-columns: repeat(var(--panels), minmax(0, 1fr)); gap: 20px; }
.chart-placeholder { display: flex; gap: 16px; align-items: flex-end; height: 190px; padding-top: 32px; border-bottom: 1px solid var(--ac-border); }
.chart-bar { flex: 1; border-radius: 6px 6px 0 0; }
.skeleton-form { width: 100%; max-width: 900px; margin: 0 auto; display: grid; gap: 28px; }
.skeleton-form-section { display: grid; gap: 20px; }
.skeleton-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 16px; }
.skeleton-field { display: grid; gap: 10px; }
.input { height: 44px; width: 100%; border-radius: 10px; }
.avatar { width: 84px; height: 84px; border-radius: 50%; }
.avatar.small { width: 36px; height: 36px; }
.button { width: 120px; height: 38px; border-radius: 10px; }
.button.small { width: 70px; height: 28px; }
.skeleton-toolbar { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.search { width: 320px; height: 42px; border-radius: 10px; }
.skeleton-table-scroll { overflow-x: auto; }
.skeleton-table { min-width: calc(var(--columns) * 95px); }
.skeleton-table-row { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); gap: 20px; padding: 20px 0; border-bottom: 1px solid var(--ac-border); }
.skeleton-table-row:first-child { padding-top: 4px; }
.skeleton-split { display: grid; grid-template-columns: minmax(230px, 1fr) minmax(0, 2fr); gap: 20px; }
.skeleton-list-row { display: flex; align-items: center; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--ac-border); }
.skeleton-copy { flex: 1; min-width: 0; }
.split-detail { display: flex; flex-direction: column; gap: 24px; min-height: 400px; }
.message { width: 65%; height: 50px; }
.message.reply { align-self: flex-end; }
.composer { margin-top: auto; }
.discovery-hero-skeleton { display: grid; justify-items: center; gap: 14px; padding: 12px 0; }
.discovery-hero-skeleton .title { width: min(760px, 88%); height: 36px; }
.discovery-filters { display: grid; gap: 18px; }
.discovery-filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.discovery-filter-grid.secondary { grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: end; }
.discovery-cards { grid-template-columns: repeat(var(--cards), minmax(0, 1fr)); }
.discovery-card { display: grid; gap: 14px; }
.skeleton-section-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.skeleton-summary-grid { display: grid; grid-template-columns: repeat(var(--cards), minmax(0, 1fr)); gap: 16px; }
.schedule-summary { display: grid; gap: 16px; }
.schedule-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.schedule-card { height: 118px; width: 100%; border-radius: 12px; }
.calendar-dashboard-grid, .pharmacy-pos-grid, .role-editor-grid, .refunds-layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 20px; }
.calendar-skeleton { min-width: 0; }
.calendar-toolbar, .calendar-weekdays, .calendar-month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.calendar-toolbar { grid-template-columns: 100px 1fr 100px; align-items: center; justify-items: center; margin-bottom: 20px; }
.calendar-weekdays { margin-bottom: 8px; }
.calendar-month-grid { grid-auto-rows: minmax(62px, auto); }
.calendar-day { display: grid; align-content: start; gap: 8px; padding: 8px; border: 1px solid var(--ac-border); border-radius: 8px; }
.calendar-event { width: 100%; height: 10px; }
.weekly-schedule-panel { display: grid; gap: 12px; }
.shift-assignment-grid { display: grid; grid-template-columns: minmax(280px, .75fr) minmax(0, 1.6fr); gap: 20px; align-items: start; }
.shift-assignment-grid > .skeleton-surface:first-child { display: grid; gap: 14px; }
.shift-guidance { display: grid; gap: 10px; margin-top: 8px; }
.schedule-fields { max-width: 850px; margin-top: 18px; }
.weekly-schedule-row { display: grid; grid-template-columns: minmax(120px, 1fr) 28px repeat(2, minmax(140px, 1fr)); align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--ac-border); }
.schedule-toggle { width: 22px; height: 22px; border-radius: 6px; }
.schedule-save { justify-self: end; }
.pharmacy-pos-grid { grid-template-columns: minmax(0, 1.5fr) minmax(300px, .85fr); align-items: start; }
.pharmacy-items-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.pharmacy-item { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--ac-border); border-radius: 12px; }
.pharmacy-cart { display: grid; gap: 14px; }
.prescription-filter { display: grid; grid-template-columns: 1fr minmax(220px, 360px); align-items: center; gap: 16px; }
.prescription-card-grid { display: grid; gap: 16px; }
.prescription-card-skeleton { display: grid; gap: 16px; }
.prescription-card-head, .prescription-footer-skeleton { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.prescription-card-head > div:first-child { display: grid; gap: 10px; }
.prescription-detail-skeleton { display: grid; gap: 6px; padding-top: 14px; border-top: 1px solid var(--ac-border); }
.prescription-footer-skeleton { align-items: center; padding-top: 14px; border-top: 1px solid var(--ac-border); }
.appointment-notice-skeleton, .owner-dashboard-hero { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 22px; border: 1px solid var(--ac-border); border-radius: 16px; background: var(--ac-surface); }
.appointment-notice-skeleton { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
.appointment-notice-skeleton .subtitle { grid-column: 1; }
.appointment-notice-skeleton .button { grid-column: 2; grid-row: 1 / span 2; }
.appointment-tabs-skeleton { display: flex; gap: 10px; overflow: hidden; padding: 8px 0 14px; border-bottom: 1px solid var(--ac-border); }
.tab { height: 38px; min-width: 140px; }
.appointment-toolbar { margin-top: 14px; }
.role-editor-grid { grid-template-columns: minmax(240px, .8fr) minmax(0, 1.6fr); margin-top: 16px; }
.detail-selector { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; gap: 16px; }
.payslip-skeleton { display: grid; gap: 22px; }
.payslip-heading { display: flex; justify-content: space-between; gap: 20px; }
.payslip-heading > div:first-child, .payslip-meta { display: grid; align-content: start; gap: 10px; }
.payslip-meta { justify-items: end; }
.payslip-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.payslip-columns .skeleton-surface { display: grid; gap: 8px; }
.payslip-totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding-top: 16px; border-top: 1px solid var(--ac-border); }
.payslip-totals > div { display: grid; gap: 10px; }
.refunds-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.refunds-layout { grid-template-columns: minmax(0, 1.7fr) minmax(280px, .8fr); }
.refunds-tables { display: grid; gap: 18px; min-width: 0; }
.subscription-plan-skeleton { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.subscription-plan-skeleton > .skeleton-surface { display: grid; gap: 14px; }
.appointment-card-grid { display: grid; gap: 14px; margin-top: 18px; }
.appointment-card { display: grid; gap: 16px; }
.appointment-detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.appointment-detail-grid > div { display: grid; gap: 10px; }
.appointment-price-details { display: grid; gap: 8px; }
.summary-skeleton { display: grid; gap: 14px; }
.summary-skeleton-row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--ac-border); }
.owner-dashboard-hero .title { width: 320px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.superadmin-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.superadmin-summary-grid > :nth-child(5) { grid-column: span 2; }
.clinic-branch-banner { min-height: 220px; display: flex; align-items: flex-end; gap: 18px; padding-top: 130px; background: linear-gradient(135deg, var(--ac-surface-muted), var(--ac-surface)); }
.clinic-avatar, .center-profile-avatar { width: 112px; height: 112px; flex: 0 0 auto; border: 5px solid var(--ac-surface); border-radius: 50%; }
.clinic-branch-name { width: min(280px, 45%); height: 30px; }
.clinic-banner-placeholder { height: 170px; border-radius: 12px; background: linear-gradient(120deg, var(--ac-surface-muted), var(--ac-border)); }
.clinic-brand-row { display: flex; align-items: center; gap: 16px; margin-top: -38px; padding: 0 16px 8px; }
.clinic-brand-row .clinic-avatar { width: 82px; height: 82px; }
.clinic-brand-row .skeleton-copy { flex: 1; }
.map-placeholder { width: 100%; height: 280px; border-radius: 12px; }
.center-profile-banner { min-height: 270px; display: flex; align-items: flex-end; gap: 18px; padding: 24px; border-radius: 16px; background: linear-gradient(120deg, var(--ac-surface-muted), var(--ac-border)); }
.center-profile-avatar { background: var(--ac-surface); }
.center-profile-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.employee-profile-skeleton { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 20px; }
.employee-identity-skeleton { display: grid; justify-items: center; align-content: start; gap: 16px; }
.employee-identity-skeleton .skeleton-surface { width: 100%; }
.checkout-skeleton-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, .8fr); gap: 20px; align-items: start; }
.checkout-summary-skeleton { display: grid; gap: 12px; }
@keyframes skeleton-shimmer { to { background-position: -140% 0; } }
@media (max-width: 900px) { .skeleton-cards, .skeleton-panels { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .discovery-filter-grid, .discovery-filter-grid.secondary, .refunds-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } .discovery-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .calendar-dashboard-grid, .pharmacy-pos-grid, .refunds-layout, .employee-profile-skeleton, .checkout-skeleton-grid, .shift-assignment-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .skeleton-fields, .skeleton-panels, .skeleton-split, .payslip-columns, .subscription-plan-skeleton { grid-template-columns: 1fr; } .skeleton-surface { padding: 18px; } .skeleton-toolbar { gap: 12px; } .discovery-filter-grid, .discovery-filter-grid.secondary, .discovery-cards, .refunds-filters, .superadmin-summary-grid, .payslip-totals, .appointment-detail-grid, .center-profile-panels { grid-template-columns: 1fr; } .superadmin-summary-grid > :nth-child(5) { grid-column: auto; } .weekly-schedule-row { grid-template-columns: minmax(80px, 1fr) 24px repeat(2, minmax(0, 1fr)); gap: 8px; } .calendar-month-grid { grid-auto-rows: minmax(46px, auto); gap: 4px; } .calendar-day { padding: 5px; } .prescription-filter, .role-editor-grid { grid-template-columns: 1fr; } .payslip-heading { flex-direction: column; } .payslip-meta { justify-items: start; } .owner-dashboard-hero { align-items: flex-start; flex-direction: column; } .clinic-branch-banner { align-items: flex-start; flex-direction: column; padding-top: 80px; } .clinic-avatar, .center-profile-avatar { width: 82px; height: 82px; } .clinic-brand-row { align-items: flex-start; flex-wrap: wrap; margin-top: -25px; padding-inline: 4px; } .clinic-banner-placeholder { height: 130px; } .center-profile-banner { min-height: 220px; align-items: flex-start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .bone { animation: none; } }
</style>
