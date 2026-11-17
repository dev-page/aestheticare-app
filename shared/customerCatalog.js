import { subscriptionLifecycle } from './subscriptionLifecycle.js'

const CARE_LISTING_TYPES = new Set(['Service', 'Consultation', 'Package'])

// Public catalogs and clinic discovery share the same visibility boundary.
export const isCustomerCareListing = post => Boolean(post
  && CARE_LISTING_TYPES.has(post.postType)
  && post.financeStatus === 'approved'
  && post.isPublished === true
  && post.archived !== true)

// Keep the name shown in discovery, clinic details, and booking aligned with
// the fields each listing type actually owns.
export const getCustomerCareListingName = post => {
  if (!post || typeof post !== 'object') return ''
  const fieldsByType = {
    Service: ['serviceName', 'title', 'productName', 'consultationName', 'packageName'],
    Consultation: ['consultationName', 'title', 'serviceName', 'productName', 'packageName'],
    Package: ['packageName', 'title', 'serviceName', 'consultationName', 'productName'],
  }
  const fields = fieldsByType[post.postType] || ['title', 'serviceName', 'consultationName', 'packageName', 'productName']
  for (const field of fields) {
    const value = String(post[field] || '').trim()
    if (value) return value
  }
  return ''
}

export const isClinicCustomerDiscoverable = (clinic, now = new Date()) => Boolean(clinic
  && clinic.isPublished === true
  && String(clinic.status || '').trim().toLowerCase() !== 'inactive'
  && subscriptionLifecycle(clinic, now).isOperational)

export function assertCustomerCheckoutSupported(metadata = {}) {
  if (String(metadata?.module || '').trim().toLowerCase() === 'customer_order') {
    throw Object.assign(new Error('Product purchases and customer orders are not supported. Please book a service or consultation.'), { status: 410 })
  }
}
