export const CLINIC_PLATFORM_AGREEMENT = Object.freeze({
  version: 'clinic-platform-agreement-v1',
  lastUpdated: 'September 13, 2026',
  title: 'Clinic Platform Agreement',
  introduction: 'This agreement applies to the clinic owner or authorized representative registering the clinic on AesthetiCare. It supplements the general Terms and Conditions and Privacy Policy.',
  sections: [
    {
      heading: '1. Platform services',
      paragraphs: [
        'AesthetiCare provides clinic operations, appointment, customer, payment, reporting, and related marketplace tools. The clinic remains responsible for its services, products, staff, customers, documents, licenses, and legal compliance.',
      ],
    },
    {
      heading: '2. Platform commissions',
      paragraphs: [
        'The platform charges a commission on eligible transactions processed through AesthetiCare:',
      ],
      bullets: [
        { label: 'Products:', text: '5% of the product sale amount.' },
        { label: 'Completed services:', text: '10% of the completed service amount.' },
      ],
      closingParagraphs: [
        "The applicable commission is recorded with the transaction and deducted when calculating the clinic's net amount. Refund treatment, including any non-refundable commission, follows the applicable platform and clinic policies.",
      ],
    },
    {
      heading: '3. Clinic responsibilities',
      paragraphs: [
        'The clinic must provide accurate information, maintain valid documents, protect account credentials, use customer data lawfully, and ensure that its employees use only the permissions assigned to them.',
      ],
    },
    {
      heading: '4. Payments and records',
      paragraphs: [
        "The clinic authorizes AesthetiCare to record eligible transactions, commissions, refunds, and settlement information needed to operate the platform and provide financial reports.",
      ],
    },
    {
      heading: '5. Agreement changes',
      paragraphs: [
        'AesthetiCare may publish a new agreement version. Material changes may require the clinic to accept the new version before continued use of affected platform features.',
      ],
    },
    {
      heading: '6. Acceptance',
      paragraphs: [
        'By signing electronically, the representative confirms that they are authorized to bind the clinic and agrees to this agreement, including the commission schedule above.',
      ],
    },
  ],
})
