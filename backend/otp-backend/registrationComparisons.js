// A name mismatch is actionable only when OCR found a labelled field with
// sufficient confidence. Arbitrary occurrences of a name elsewhere on a page
// are not evidence that the name belongs to that field.
const BUSINESS_DOCUMENTS = new Set(['businessPermit', 'dohAccreditation', 'birRegistration', 'sanitaryCertificate'])
const NAME_SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V'])
const KNOWN_OCR_FIELD_LABELS = [
  'full\\s+name', 'name', 'name\\s+of\\s+holder', 'first\\s+name', 'given\\s+names?',
  'last\\s+name', 'surname', 'family\\s+name', 'birth\\s*date', 'date\\s+of\\s+birth', 'dob',
  'business\\s+name', 'registered\\s+(?:business\\s+)?name', 'trade\\s+name',
  'business\\s*(?:\\/|and)\\s*trade\\s+name', 'clinic\\s+name', 'establishment\\s+name',
  'name\\s+of\\s+(?:business|establishment|clinic)', 'permit\\s+holder(?:\\s+name)?',
  'owner(?:\\s+name)?', 'proprietor(?:\\s+name)?', 'registrant\\s+name', 'applicant\\s+name',
  'authorized\\s+representative', 'representative(?:\\s+name)?', 'authorized\\s+person',
  'authorizing\\s+person', 'issued?', 'issue\\s+date', 'expiry\\s+date', 'expiration\\s+date',
  'date\\s+of\\s+expiry', 'valid\\s+until', 'address', 'document\\s+(?:no|number)',
]
const clean = (value) => String(value || '').trim()
const words = (value) => clean(value).toUpperCase().match(/[A-Z0-9]+/g) || []
const isKnownOcrFieldLabel = (value) => KNOWN_OCR_FIELD_LABELS.some((label) =>
  new RegExp(`^(?:${label})(?:\\s*[:#\\-]\\s*.*)?$`, 'i').test(String(value || '').trim())
)

function extractLabelled(text, labels) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const found = []
  for (let i = 0; i < lines.length; i += 1) {
    for (const label of labels) {
      const inline = lines[i].match(new RegExp(`^(?:${label})\\s*[:#\\-]\\s*(.+)$`, 'i'))
      const labelOnly = new RegExp(`^(?:${label})\\s*[:#\\-]?\\s*$`, 'i').test(lines[i])
      const value = inline?.[1] || (labelOnly ? lines[i + 1] : '')
      if (value && !isKnownOcrFieldLabel(value)) {
        found.push(value.trim().slice(0, 160))
      }
    }
  }
  const unique = [...new Set(found)]
  return unique.length === 1 ? unique[0] : ''
}

function normalizedDate(value) {
  const raw = clean(value)
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  const numeric = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  // A numeric day/month pair may be read either way on a Philippine ID.
  if (numeric && Number(numeric[1]) <= 12 && Number(numeric[2]) <= 12 && numeric[1] !== numeric[2]) return ''
  let year, month, day
  if (iso) [, year, month, day] = iso
  else if (numeric) {
    year = numeric[3]
    month = Number(numeric[1]) > 12 ? numeric[2] : numeric[1]
    day = Number(numeric[1]) > 12 ? numeric[1] : numeric[2]
  } else {
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime()) || !/[a-z]/i.test(raw)) return ''
    return parsed.toISOString().slice(0, 10)
  }
  const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${result}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : ''
}

function comparison(field, label, enteredValue, detectedValue, confidence, kind = 'name') {
  const entered = clean(enteredValue)
  const detected = clean(detectedValue)
  let status = 'needs_review'
  if (entered && detected && Number.isFinite(confidence) && confidence >= 0.75) {
    if (kind === 'date') {
      const expectedDate = normalizedDate(entered)
      const actualDate = normalizedDate(detected)
      if (expectedDate && actualDate) status = expectedDate === actualDate ? 'match' : 'mismatch'
    } else {
      const expected = words(entered)
      const actual = words(detected)
      if (expected.length >= (kind === 'person' ? 2 : 1) && actual.length) {
        const personName = expected.filter((part) => !NAME_SUFFIXES.has(part))
        status = kind === 'person'
          ? personName.length >= 2 && [personName[0], personName[personName.length - 1]].every((part) => actual.includes(part)) ? 'match' : 'mismatch'
          : expected.every((part) => actual.includes(part)) ? 'match' : 'mismatch'
      }
    }
  }
  return { field, label, enteredValue: entered, detectedValue: detected, status }
}

export function compareRegistrationFields({ docKey, text, application = {}, user = {}, confidence = null }) {
  const results = []
  const snapshot = application.registrationOcrSnapshot || {}
  const hasSnapshot = Boolean(application.registrationOcrSnapshot && typeof application.registrationOcrSnapshot === 'object')
  const firstName = clean(hasSnapshot ? snapshot.firstName : user.firstName || application.firstName)
  const middleName = clean(hasSnapshot ? snapshot.middleName : user.midName || user.middleName || application.midName || application.middleName)
  const lastName = clean(hasSnapshot ? snapshot.lastName : user.lastName || application.lastName)
  const suffix = clean(hasSnapshot ? snapshot.suffix : user.suffix || application.suffix)
  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ')
  const evidenceConfidence = snapshot.source === 'legacy-review-time' ? null : confidence
  const isAuthorization = docKey === 'authorizationLetter'
  const permitHolderIsRegistrant = typeof snapshot.permitHolderIsRegistrant === 'boolean'
    ? snapshot.permitHolderIsRegistrant
    : application.permitHolderIsRegistrant !== false
  if (docKey === 'governmentIdRepresentativeFront' || isAuthorization) {
    const labels = isAuthorization
      ? ['registrant\\s+name', 'applicant\\s+name', 'authorized\\s+representative', 'representative(?:\\s+name)?', 'authorized\\s+person']
      : ['full\\s+name', 'name', 'name\\s+of\\s+holder']
    let detected = extractLabelled(text, labels)
    if (!detected && !isAuthorization) {
      const first = extractLabelled(text, ['first\\s+name', 'given\\s+names?'])
      const last = extractLabelled(text, ['last\\s+name', 'surname', 'family\\s+name'])
      if (first && last) detected = `${first} ${last}`
    }
    results.push(comparison('registrantName', 'Registrant name', fullName, detected, evidenceConfidence, 'person'))
  }
  if (docKey === 'governmentIdRepresentativeFront') {
    const birth = hasSnapshot ? snapshot.birthDate : user.birthDate || application.birthDate
    const entered = birth && typeof birth.toDate === 'function' ? birth.toDate().toISOString().slice(0, 10) : birth instanceof Date ? birth.toISOString().slice(0, 10) : birth
    results.push(comparison('birthDate', 'Birth date', entered, extractLabelled(text, ['birth\\s*date', 'date\\s+of\\s+birth', 'dob']), evidenceConfidence, 'date'))
  }
  if (BUSINESS_DOCUMENTS.has(docKey)) {
    const entered = hasSnapshot ? snapshot.businessName : application.businessName || application.clinicName || application.companyName || user.companyName
    const detected = extractLabelled(text, [
      'business\\s+name', 'registered\\s+(?:business\\s+)?name', 'trade\\s+name',
      'business\\s*(?:\\/|and)\\s*trade\\s+name', 'clinic\\s+name', 'establishment\\s+name',
      'name\\s+of\\s+(?:business|establishment|clinic)',
    ])
    results.push(comparison('businessName', 'Clinic / business name', entered, detected, evidenceConfidence))
  }
  if (docKey === 'businessPermit' || (isAuthorization && !permitHolderIsRegistrant)) {
    const labels = isAuthorization
      ? ['permit\\s+holder', 'owner(?:\\s+name)?', 'authorizing\\s+person']
      : ['permit\\s+holder(?:\\s+name)?', 'owner(?:\\s+name)?', 'proprietor(?:\\s+name)?']
    const enteredHolderName = permitHolderIsRegistrant
      ? fullName
      : hasSnapshot ? snapshot.permitHolderName : application.permitHolderName
    results.push(comparison('permitHolderName', 'Permit holder', enteredHolderName, extractLabelled(text, labels), evidenceConfidence, 'person'))
  }
  return results
}
