// Copy Vue's reactive schedule into plain objects before sending it to Firestore.
export function copyOnboardingOperatingHours(operatingHours, dayKeys) {
  return Object.fromEntries(dayKeys.map((key) => {
    const day = operatingHours[key]
    return [key, {
      closed: day.closed,
      ranges: day.ranges.map(({ open, close }) => ({ open, close })),
    }]
  }))
}
