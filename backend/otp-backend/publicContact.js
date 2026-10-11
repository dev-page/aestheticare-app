import { createHash } from 'node:crypto'

export function validateContact(body = {}) {
  const fields = { name: 100, email: 254, subject: 160, message: 5000 }
  const contact = {}
  for (const [key, limit] of Object.entries(fields)) {
    if (typeof body[key] !== 'string') throw new Error('Please complete all contact fields.')
    contact[key] = body[key].trim()
    if (!contact[key] || contact[key].length > limit) throw new Error(`Please enter a valid ${key} (up to ${limit} characters).`)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new Error('Please enter a valid email address.')
  contact.email = contact.email.toLowerCase()
  return contact
}

export function registerPublicContact(app, admin) {
  app.post('/public/contact', async (req, res) => {
    let contact
    try {
      contact = validateContact(req.body)
      if (req.body.website) return res.status(400).json({ error: 'Unable to submit this message.' })
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    try {
      const db = admin.firestore()
      const now = Date.now()
      const keys = [contact.email, req.ip || 'unknown'].map(value => createHash('sha256').update(value).digest('hex'))
      const ticket = db.collection('supportTickets').doc()
      const notification = db.collection('notifications').doc()
      await db.runTransaction(async transaction => {
        const refs = [...new Set(keys)].map(key => db.collection('publicContactLimits').doc(key))
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)))
        const limits = snapshots.map(snapshot => {
          const previous = snapshot.data() || {}
          return now - (previous.startedAt || 0) < 15 * 60 * 1000 ? previous : { startedAt: now, count: 0 }
        })
        if (limits.some(limit => limit.count >= 3)) {
          const error = new Error('Too many messages. Please try again in 15 minutes.')
          error.status = 429
          throw error
        }
        refs.forEach((ref, index) => transaction.set(ref, { ...limits[index], count: limits[index].count + 1 }))
        const stamp = admin.firestore.FieldValue.serverTimestamp()
        transaction.set(ticket, {
          userId: '', userName: contact.name, userEmail: contact.email, role: 'Visitor',
          subject: contact.subject, description: contact.message, category: 'Other',
          severity: 'Low', status: 'Open', branchId: '', source: 'landing-contact',
          createdAt: stamp, updatedAt: stamp,
        })
        transaction.set(notification, {
          recipientRole: 'Superadmin', type: 'support_issue', title: 'New Contact Message',
          message: `${contact.name}: ${contact.subject}`, link: '/superadmin/tickets', read: false, createdAt: stamp,
        })
      })
      return res.status(201).json({ success: true })
    } catch (error) {
      if (error.status === 429) return res.status(429).json({ error: error.message })
      console.error('Public contact submission failed:', error)
      return res.status(500).json({ error: 'We could not send your message. Please try again.' })
    }
  })
}
