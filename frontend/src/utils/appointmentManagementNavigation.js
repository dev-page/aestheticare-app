export const resolveAppointmentManagementState = ({
  query = {},
  canView = false,
  canReview = false,
  canOnline = false,
  canQueue = false,
} = {}) => {
  const canUseAppointments = canView || canReview
  const requestedTab = query.tab === 'queue' ? 'queue' : 'appointments'
  const activeTab = requestedTab === 'queue' && canQueue
    ? 'queue'
    : canUseAppointments
      ? 'appointments'
      : canQueue
        ? 'queue'
        : 'appointments'

  const wantsReview = query.view === 'review' || query.tab === 'requests'
  const appointmentView = canReview && (wantsReview || !canView) ? 'review' : 'all'
  const onlineMode = activeTab === 'queue'
    && canOnline
    && (query.mode === 'online' || !canView)

  return { activeTab, appointmentView, onlineMode }
}

export const resolveAppointmentBranchQuery = ({
  queryBranchId,
  selectedBranchId,
  selectionTouched = false,
} = {}) => {
  const branchId = selectionTouched ? selectedBranchId : queryBranchId
  const normalized = String(branchId || '').trim()
  return normalized || undefined
}
