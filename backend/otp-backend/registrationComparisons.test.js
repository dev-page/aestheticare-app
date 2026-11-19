import test from 'node:test'
import assert from 'node:assert/strict'
import { compareRegistrationFields } from './registrationComparisons.js'

const application = { clinicName: 'Bright Clinic', permitHolderIsRegistrant: false, permitHolderName: 'Maria Santos' }
const user = { firstName: 'Anna', lastName: 'Reyes', birthDate: '1990-01-02' }
const compare = (docKey, text, confidence = 0.95) => compareRegistrationFields({ docKey, text, application, user, confidence })

test('compares labelled ID values with entered name and birth date', () => {
  const results = compare('governmentIdRepresentativeFront', 'Full Name: Anna Reyes\nDate of Birth: 1990-01-02')
  assert.deepEqual(results.map(({ status }) => status), ['match', 'match'])
  assert.equal(results[0].detectedValue, 'Anna Reyes')
})

test('a bare OCR field label is not reused as the previous field value', () => {
  const results = compare('governmentIdRepresentativeFront', 'Name:\nDate of Birth:\n1990-01-02')
  assert.equal(results[0].detectedValue, '')
  assert.equal(results[0].status, 'needs_review')
  assert.equal(results[1].status, 'match')

  const adjacentInlineLabel = compare('governmentIdRepresentativeFront', 'Name:\nDate of Birth: 1990-01-02')
  assert.equal(adjacentInlineLabel[0].detectedValue, '')
  assert.equal(adjacentInlineLabel[0].status, 'needs_review')
})

test('compares the declared permit holder as separate name tokens', () => {
  const results = compare('businessPermit', 'Business Name: Bright Clinic\nPermit Holder: Maria Santos')
  assert.deepEqual(results.map(({ status }) => status), ['match', 'match'])
})

test('compares the business permit holder with the Step 1 registrant when they are the same person', () => {
  const results = compareRegistrationFields({
    docKey: 'businessPermit',
    text: 'Business Name: Bright Clinic\nOwner Name: Anna Reyes',
    confidence: 0.95,
    application: {
      registrationOcrSnapshot: {
        firstName: 'Anna',
        lastName: 'Reyes',
        businessName: 'Bright Clinic',
        permitHolderIsRegistrant: true,
      },
      permitHolderIsRegistrant: false,
      permitHolderName: 'Maria Santos',
    },
    user: { firstName: 'Changed', lastName: 'Profile' },
  })
  assert.deepEqual(results.map(({ field, status }) => [field, status]), [
    ['businessName', 'match'],
    ['permitHolderName', 'match'],
  ])
  assert.equal(results[1].enteredValue, 'Anna Reyes')
})

test('labelled mismatches and missing values remain reviewable', () => {
  const results = compare('governmentIdRepresentativeFront', 'Name: Someone Else\nIssued: 1990-01-02')
  assert.deepEqual(results.map(({ status }) => status), ['mismatch', 'needs_review'])
  assert.equal(results[1].detectedValue, '')
})

test('unlabelled or low confidence text is never treated as a confirmed match', () => {
  assert.equal(compare('businessPermit', 'Bright Clinic Maria Santos')[0].status, 'needs_review')
  assert.equal(compare('businessPermit', 'Business Name: Bright Clinic', 0.3)[0].status, 'needs_review')
})

test('ambiguous numeric ID dates remain in manual review', () => {
  const results = compare('governmentIdRepresentativeFront', 'Full Name: Anna Reyes\nDate of Birth: 02/01/1990')
  assert.equal(results[1].status, 'needs_review')
})

test('authorization letters compare the applicant with the named representative', () => {
  const results = compare('authorizationLetter', 'Applicant Name: Anna Reyes\nPermit Holder: Maria Santos')
  assert.deepEqual(results.map(({ field, status }) => [field, status]), [
    ['registrantName', 'match'],
    ['permitHolderName', 'match'],
  ])
})

test('a legal-name suffix does not replace the surname during comparison', () => {
  const results = compareRegistrationFields({
    docKey: 'governmentIdRepresentativeFront',
    text: 'Full Name: Anna Reyes',
    confidence: 0.95,
    user: { firstName: 'Anna', lastName: 'Reyes', suffix: 'Jr.' },
  })
  assert.equal(results[0].status, 'match')
})

test('comparison uses the immutable submission values after profile edits', () => {
  const results = compareRegistrationFields({
    docKey: 'businessPermit',
    text: 'Business Name: Bright Clinic',
    confidence: 0.95,
    application: {
      clinicName: 'New Clinic Name',
      registrationOcrSnapshot: {
        businessName: 'Bright Clinic',
        firstName: 'Anna',
        lastName: 'Reyes',
      },
    },
    user: { firstName: 'Changed', lastName: 'Profile' },
  })
  assert.equal(results[0].enteredValue, 'Bright Clinic')
  assert.equal(results[0].status, 'match')
})

test('blank submission values do not fall back to newer profile or clinic values', () => {
  const results = compareRegistrationFields({
    docKey: 'businessPermit',
    text: 'Business Name: Bright Clinic',
    confidence: 0.99,
    application: {
      businessName: 'Bright Clinic',
      registrationOcrSnapshot: {
        firstName: '',
        lastName: '',
        businessName: '',
      },
    },
    user: { firstName: 'Anna', lastName: 'Reyes', companyName: 'Bright Clinic' },
  })
  assert.equal(results[0].enteredValue, '')
  assert.equal(results[0].status, 'needs_review')
})

test('legacy applications without submission-time snapshots stay in manual review', () => {
  const results = compareRegistrationFields({
    docKey: 'businessPermit',
    text: 'Business Name: Bright Clinic\nPermit Holder: Maria Santos',
    confidence: 0.99,
    application: {
      clinicName: 'Bright Clinic',
      permitHolderIsRegistrant: false,
      permitHolderName: 'Maria Santos',
      registrationOcrSnapshot: {
        source: 'legacy-review-time',
        businessName: 'Bright Clinic',
        permitHolderIsRegistrant: false,
        permitHolderName: 'Maria Santos',
      },
    },
  })
  assert.deepEqual(results.map(({ status }) => status), ['needs_review', 'needs_review'])
})

test('BIR compares only the clinic name and never VAT classification', () => {
  const results = compare('birRegistration', 'Business Name: Bright Clinic\nTaxpayer type: VAT')
  assert.deepEqual(results.map(({ field }) => field), ['businessName'])
})
