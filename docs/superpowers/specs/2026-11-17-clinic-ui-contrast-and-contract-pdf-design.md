# Clinic UI Contrast and Contract PDF Design

## Intent

Make the clinic Inbox, Role Details, Employee Profile, Activities, Notifications, and Service Listings easier to read and use in both light and dark themes. Let clinic staff open the applied client contract as a PDF in a separate browser tab.

## Goals

- Keep Inbox message text readable against both incoming and outgoing message bubbles in dark mode and light mode.
- Improve the Role Details delete action and keep the detail form actions on one aligned row where space allows.
- Remove Staff Arrangement and Address from the self-service employee profile form. Do not erase existing stored address data as part of this UI change.
- Present Activities in a table with pagination while preserving the existing role and branch filtering.
- Make Notifications and Service Listings legible in both themes, including badges, statuses, contract preview, and action buttons.
- Align Service Listing card actions consistently, with Delete clearly styled as a destructive action.
- Keep the existing in-page contract preview and add a control to open a generated PDF in a new tab.

## Non-goals

- Change notification delivery, activity data access, service listing workflow, role permissions, or profile ownership rules.
- Change the saved client contract content or appearance settings.
- Delete existing address values from Firestore.
- Make global dark-theme changes that could alter unrelated pages.

## Approaches

1. **Page-scoped theme styling and a supplementary PDF action (recommended).** Add page-specific light/dark styles using the shared design tokens; retain the in-page contract preview and add a PDF action that renders the existing structured document with the installed `jsPDF` dependency. This limits visual regressions and keeps both quick preview and printable output available.
2. **Global theme override changes and PDF-only contract display.** Relax shared theme overrides and replace the inline contract preview with a PDF view. This could reduce some local CSS, but risks changing unrelated screens and removes the quick in-page scan.

The proposed implementation is approach 1. The PDF should supplement the current preview and open in a new tab.

## Proposed implementation

- Inbox: correct dark-mode message bubble and text contrast with scoped theme-aware colors.
- Role Details: use a compact outlined danger treatment for Delete Role; place Discard, optional Reset, and Save actions in a full-width responsive action row.
- Employee Profile: remove Staff Arrangement and Address controls. Keep phone, name, and profile save behavior. Stop this form from writing address data, while leaving previously saved data untouched.
- Activities: replace activity cards with a responsive, horizontally scrollable table and Previous/Next pagination. Preserve filtering, ordering, loading, and empty states.
- Notifications: make module header, panel, text, selection row, badges, and buttons theme-aware.
- Service Listings: make page panels, contract preview, listing cards, statuses, and controls theme-aware; arrange available Edit/Archive/Delete actions evenly and give Delete a clear danger style.
- Contract PDF: add a PDF action to the applied contract area. Generate the PDF from the existing structured contract data and saved appearance; open it in a new tab without changing the saved contract.

## Constraints and verification

- Reuse current Vue components, shared design tokens, structured contract builder, and the installed `jsPDF` package.
- Preserve working data and authorization flows.
- Verify the production build and inspect the final diff for unintended changes. No test suite will be added or run for this UI task.
