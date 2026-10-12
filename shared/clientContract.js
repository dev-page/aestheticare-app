import { serviceOnlyClinicPolicies } from './clinicPolicyContent.js'

export const clientContractPolicies = (source = {}, { source: bookingSource = '', branch = null } = {}) => {
  const policy = serviceOnlyClinicPolicies(source)
  const linked = Array.isArray(branch?.enforcedPolicyKeys) ? new Set(branch.enforcedPolicyKeys) : null
  const definitions = [
    ['paymentPolicy', 'Payment Policy', 'servicePaymentPolicyEnabled'],
    ['cancellationPolicy', 'Cancellation Policy', 'serviceCancellationPolicyEnabled'],
    ['reschedulePolicy', 'Rescheduling Policy', 'serviceReschedulingPolicyEnabled'],
    ['noShowPolicy', 'No-Show Policy', 'serviceNoShowPolicyEnabled'],
    ['walkInPolicy', 'Walk-In Policy', 'walkInPolicyEnabled'],
  ]
  return definitions.filter(([key, , flag]) => {
    const enabled = policy[flag] ?? policy[`${key}Enabled`]
    return enabled === true && String(policy[key] || '').trim() && (!linked || linked.has(key))
      && (key !== 'walkInPolicy' || !bookingSource || bookingSource === 'walk_in')
  }).map(([key, title]) => ({ key, title, text: String(policy[key]).trim() }))
}

export const normalizeContractAppearance = (source = {}) => {
  source = source && typeof source === 'object' ? source : {}
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback
  return {
    font: ['sans', 'serif', 'classic'].includes(source.font) ? source.font : 'sans',
    fontSize: number(source.fontSize, 14, 12, 20),
    alignment: ['left', 'center', 'justify'].includes(source.alignment) ? source.alignment : 'left',
    headingColor: color(source.headingColor, '#412d20'),
    accentColor: color(source.accentColor, '#b78055'),
    spacing: number(source.spacing, 20, 12, 36),
  }
}

export const buildClientContractDocument = (policy = {}, options = {}) => {
  const sections = []
  if (options.serviceName) sections.push({ title: 'Booked service', text: String(options.serviceName).trim() })
  sections.push(...clientContractPolicies(policy, options).map(({ title, text }) => ({ title, text })))
  const additional = String(policy.clientContract?.additionalTerms || '').trim()
  if (additional) sections.push({ title: 'Additional clinic terms', text: additional, formatted: true })
  const serviceTerms = String(options.serviceTerms || '').trim()
  if (serviceTerms) sections.push({ title: 'Service-specific terms', text: serviceTerms })
  return { version: 1, appearance: normalizeContractAppearance(policy.clientContract?.appearance), title: 'Client treatment agreement', intro: 'Review your booked service, schedule, price, and the applicable terms below before signing.', sections, acknowledgement: 'By signing, I confirm that I have reviewed this agreement and accept the applicable terms for my appointment.' }
}

// Booking acceptance covers commercial terms only. It never substitutes for
// the recipient's separate treatment agreement or includes clinical free text.
export const buildBookingTermsDocument = (policy = {}, options = {}) => ({
  version: 1,
  appearance: normalizeContractAppearance(policy.clientContract?.appearance),
  title: 'Booking and payment agreement',
  intro: 'The person arranging this booking accepts the applicable booking and payment terms under their own name. Walk-in appointments require full payment for each appointment.',
  sections: clientContractPolicies(policy, options)
    .filter(({ key }) => ['paymentPolicy', 'cancellationPolicy', 'reschedulePolicy', 'noShowPolicy'].includes(key))
    .map(({ title, text }) => ({ title, text })),
  acknowledgement: 'I accept the displayed prices, schedules, payment, cancellation, rescheduling, and no-show terms for this booking. My signature does not provide consent to treatment for another person. The service recipient must sign their own treatment agreement before check-in.',
})

export const buildClientContract = (policy = {}, options = {}) => {
  const sections = ['Client treatment agreement', 'Review your booked service, schedule, price, and the applicable terms below before signing.']
  if (options.serviceName) sections.push(`Booked service\n${String(options.serviceName).trim()}`)
  sections.push(...clientContractPolicies(policy, options).map(item => `${item.title}\n${item.text}`))
  const additional = String(policy.clientContract?.additionalTerms || '').trim()
  if (additional) sections.push(`Additional clinic terms\n${additional}`)
  const serviceTerms = String(options.serviceTerms || '').trim()
  if (serviceTerms) sections.push(`Service-specific terms\n${serviceTerms}`)
  sections.push('By signing, I confirm that I have reviewed this agreement and accept the applicable terms for my appointment.')
  return sections.join('\n\n')
}
