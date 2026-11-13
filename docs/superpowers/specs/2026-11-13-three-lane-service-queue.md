# Three-Lane Service Queue Design

## Goal

Make the clinic's in-person Service Queue read like a live work queue, with three clear stages and inactive records accessible separately.

## Approved behavior

- Show a board with **Waiting**, **In Service**, and **Finished** lanes.
- Open on today's date, using the user's local calendar date. Keep date selection and search available.
- Display appointment dates as **Month Day, Year** (for example, November 13, 2026).
- Put `Scheduled`, `Paid`, `Checked in`, and `Ready to Start` visits in Waiting; `Ongoing` visits in In Service; and `Awaiting Customer Confirmation`, `Balance Due`, and `Completed` visits in Finished.
- Clearly distinguish a visit awaiting customer confirmation or balance settlement from one fully completed.
- Keep cancelled, rejected, no-show, incomplete, unpaid, approval-pending, contract-pending, and other unclassified records accessible through a separate history/other-appointments view.
- Preserve current appointment permissions and actions. Do not change backend transitions or the separate Online Consultations view.
- Show lane counts and helpful empty states. Use three columns on wide screens and stack lanes on narrow screens. Follow the existing light/dark theme.
