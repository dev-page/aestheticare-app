export const MAX_TREATMENT_COURSE_VISITS = 50

export const normalizeTreatmentCourseSteps = (steps) => (Array.isArray(steps) ? steps : [])
  .map(step => ({
    serviceId: String(step?.serviceId || '').trim(),
    visitCount: Math.trunc(Number(step?.visitCount || 0)),
    minimumGapDays: Math.trunc(Number(step?.minimumGapDays || 0)),
  }))

export const treatmentCourseVisitCount = (steps) => normalizeTreatmentCourseSteps(steps)
  .reduce((total, step) => total + (Number.isFinite(step.visitCount) ? step.visitCount : 0), 0)

export const validateTreatmentCourseSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) return 'Add at least one treatment course step.'
  if (steps.some(step => !Number.isInteger(Number(step?.visitCount)) || Number(step.visitCount) < 1 || Number(step.visitCount) > MAX_TREATMENT_COURSE_VISITS)) {
    return 'Each course step must include 1 to 50 whole-number visits.'
  }
  if (steps.some(step => !Number.isInteger(Number(step?.minimumGapDays)) || Number(step.minimumGapDays) < 1 || Number(step.minimumGapDays) > 365)) {
    return 'The minimum gap between visits must be a whole number from 1 to 365 days.'
  }
  const normalizedSteps = normalizeTreatmentCourseSteps(steps)
  if (normalizedSteps.some(step => !step.serviceId)) return 'Choose a service or consultation for every course step.'
  const total = treatmentCourseVisitCount(normalizedSteps)
  if (total < 2 || total > MAX_TREATMENT_COURSE_VISITS) return 'A treatment course must include 2 to 50 visits in total.'
  return ''
}

export const validateTreatmentCourseComposition = (steps, servicesById) => {
  const shapeError = validateTreatmentCourseSteps(steps)
  if (shapeError) return shapeError
  const getService = id => servicesById instanceof Map ? servicesById.get(id) : servicesById?.[id]
  const services = normalizeTreatmentCourseSteps(steps).map(step => getService(step.serviceId))
  if (services.some(service => !service || !['service', 'consultation'].includes(String(service.postType || '').toLowerCase()))) {
    return 'Every course step must use an available service or consultation.'
  }
  const consultationVisits = normalizeTreatmentCourseSteps(steps).reduce((total, step, index) => total + (String(services[index]?.postType || '').toLowerCase() === 'consultation' ? step.visitCount : 0), 0)
  const serviceVisits = normalizeTreatmentCourseSteps(steps).reduce((total, step, index) => total + (String(services[index]?.postType || '').toLowerCase() === 'service' ? step.visitCount : 0), 0)
  if (consultationVisits > 1 || (consultationVisits === 0 && serviceVisits < 2) || (consultationVisits === 1 && serviceVisits < 1)) {
    return 'A treatment course must include at least two service visits, or one consultation and at least one service visit.'
  }
  return ''
}

export const buildTreatmentCourseSessions = (steps, servicesById) => normalizeTreatmentCourseSteps(steps)
  .flatMap((step, stageIndex) => {
    const service = servicesById instanceof Map ? servicesById.get(step.serviceId) : servicesById?.[step.serviceId]
    if (!service) return []
    const serviceName = service.title || service.serviceName || service.consultationName || service.name || 'Service'
    return Array.from({ length: step.visitCount }, (_, visitIndex) => ({
      serviceId: step.serviceId,
      serviceName,
      durationMinutes: Math.max(1, Number(service.durationMinutes || 60)),
      stageNumber: stageIndex + 1,
      stageVisitNumber: visitIndex + 1,
      stageVisitCount: step.visitCount,
      sessionIntervalDays: step.minimumGapDays,
    }))
  })
