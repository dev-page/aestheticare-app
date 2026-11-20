const monthNames = new Map([
  ['jan', 1], ['january', 1], ['feb', 2], ['february', 2], ['mar', 3], ['march', 3],
  ['apr', 4], ['april', 4], ['may', 5], ['jun', 6], ['june', 6], ['jul', 7],
  ['july', 7], ['aug', 8], ['august', 8], ['sep', 9], ['sept', 9], ['september', 9],
  ['oct', 10], ['october', 10], ['nov', 11], ['november', 11], ['dec', 12], ['december', 12],
])

const toIsoDate = (year, month, day) => {
  const y = Number(year), m = Number(month), d = Number(day)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (!Number.isInteger(y) || y < 1900 || y > 2200 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return ''
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const monthNumber = value => monthNames.get(String(value || '').toLowerCase().replace(/\.$/, '')) || 0

const datePattern = /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4})\b/gi

const parseDate = value => {
  const text = String(value || '').trim().replace(/,/g, '')
  let match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (match) return toIsoDate(match[1], match[2], match[3])

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const first = Number(match[1]), second = Number(match[2])
    // A numeric date where both leading values could be a month is ambiguous;
    // ask for manual review instead of silently deciding which date it means.
    if (first <= 12 && second <= 12) return ''
    return first > 12 ? toIsoDate(match[3], second, first) : toIsoDate(match[3], first, second)
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (match) return toIsoDate(match[3], monthNumber(match[2]), match[1])
  match = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s+(\d{4})$/)
  if (match) return toIsoDate(match[3], monthNumber(match[1]), match[2])
  return ''
}

const getPhilippineDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const extractEstablishmentName = value => {
  const lines = String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const labelPattern = /^(?:name\s+of\s+(?:the\s+)?(?:establishment|business)|(?:establishment|business)\s+name|registered\s+(?:business|establishment)\s+name|trade\s+name)\s*[:\-]?\s*(.*)$/i
  const nextFieldPattern = /^(?:l\.?\s*t\.?\s*o\.?\b|license\s+to\s+operate\b|(?:lto\s+)?(?:number|no\.?|#)\b|address\b|(?:date\s+of\s+)?(?:issue|expiry|expiration)\b|valid\s+(?:from|until|through)\b|contact(?:\s+person)?\b|owner\b|proprietor\b|trade\s+name\b)/i

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(labelPattern)
    if (!match) continue
    let candidate = String(match[1] || '').trim()
    if (!candidate) {
      const next = lines[index + 1] || ''
      if (!next || nextFieldPattern.test(next)) continue
      candidate = next
    }
    candidate = candidate
      .replace(/\s+(?:l\.?\s*t\.?\s*o\.?\s*(?:no\.?|number|#)|license\s+to\s+operate|address|expiry|expiration|valid\s+(?:from|until|through))\b.*$/i, '')
      .replace(/\s+(?:contact(?:\s+person)?|owner|proprietor)\s*[:\-]\s*.*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[\s,;:.-]+$/, '')
      .trim()
    if (candidate.length >= 2 && candidate.length <= 200) return candidate
  }
  return ''
}

export const analyzeFdaLtoText = (value, today = getPhilippineDate()) => {
  const extractedText = String(value || '').replace(/\u0000/g, '').trim().slice(0, 12000)
  if (!extractedText) {
    return {
      ltoNumber: '', businessName: '', expiryDate: '', status: 'needs_review',
      reason: 'OCR could not read text from this file. Check the document image manually.', extractedText,
    }
  }

  const numberMatch = extractedText.match(/(?:\bL\.?\s*T\.?\s*O\.?\s*(?:NO\.?|NUMBER|#)|\bLICENSE\s+TO\s+OPERATE\s*(?:NO\.?|NUMBER|#))\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{3,39})/i)
  const ltoNumber = String(numberMatch?.[1] || '').replace(/[.,;:]+$/, '').trim()
  const businessName = extractEstablishmentName(extractedText)
  const flatText = extractedText.replace(/\s+/g, ' ')
  const expiryLabel = /(?:expiry(?:\s+date)?|expiration(?:\s+date)?|date\s+of\s+(?:expiry|expiration)|valid\s+(?:until|through|up\s+to)|validity\s+(?:date|until|period)|expires?\s+(?:on|at)|valid\s+from)/gi
  const candidateDates = []
  for (const labelMatch of flatText.matchAll(expiryLabel)) {
    const start = (labelMatch.index || 0) + labelMatch[0].length
    const tail = flatText.slice(start, start + 100)
    const nextField = tail.search(/\b(?:l\.?\s*t\.?\s*o\.?\s*(?:no\.?|number)|license\s+to\s+operate|issued\s+(?:on|date)|date\s+of\s+issue|business\s+name|establishment\s+name|address)\b/i)
    const segment = nextField < 0 ? tail : tail.slice(0, nextField)
    const matches = [...segment.matchAll(datePattern)]
    if (!matches.length) {
      candidateDates.push('')
      continue
    }
    // "Valid from X to Y" states a period, so the end date is the expiry.
    const isValidFrom = /valid\s+from/i.test(labelMatch[0])
    const isPeriod = isValidFrom && /\b(?:to|through|until)\b/i.test(segment)
    if (isValidFrom && !isPeriod) {
      candidateDates.push('')
      continue
    }
    const selected = isPeriod ? matches[matches.length - 1] : matches[0]
    candidateDates.push(parseDate(selected[0]))
  }
  const uniqueDates = [...new Set(candidateDates.filter(Boolean))]
  const ambiguousDateFound = candidateDates.some(candidate => !candidate)
  const expiryDate = uniqueDates.length === 1 && !ambiguousDateFound ? uniqueDates[0] : ''

  if (!expiryDate) {
    return {
      ltoNumber, businessName, expiryDate: '', status: 'needs_review',
      reason: ltoNumber
        ? 'OCR read the LTO number, but could not confidently read one expiry date. Review the original document.'
        : 'OCR could not confidently read the LTO number and expiry date. Review the original document.',
      extractedText,
    }
  }
  if (uniqueDates.length !== 1 || expiryDate < today) {
    return {
      ltoNumber, businessName, expiryDate, status: expiryDate < today ? 'expired' : 'needs_review',
      reason: expiryDate < today
        ? `The document shows an expiry date of ${expiryDate}. Verify the original document and current FDA record.`
        : 'OCR found conflicting expiry dates. Review the original document.',
      extractedText,
    }
  }

  return {
    ltoNumber, businessName, expiryDate, status: 'not_expired',
    reason: `The printed expiry date is ${expiryDate}. OCR does not verify that the LTO is authentic or currently active.`,
    extractedText,
  }
}
