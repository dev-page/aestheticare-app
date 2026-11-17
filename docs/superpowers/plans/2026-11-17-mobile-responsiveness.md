# Mobile Responsiveness Implementation Plan

> **For agentic workers:** Implement this plan in the current session and review the final diff.

**Goal:** Make the landing navigation usable on short mobile screens and prevent clinic pages, shared tables, loaders, and charts from overflowing or becoming unreadable at phone widths.

**Architecture:** Fix the landing menu's viewport and flex scrolling behavior in `Home.vue`. Improve shared responsive rules in `style.css`, the shared clinic sidebar, and common table, modal, and skeleton components so routed pages inherit consistent containment. Keep dense records in local scroll regions and stack multi-column content where it fits.

**Tech Stack:** Vue 3, Tailwind CSS, component-scoped CSS, global CSS.

**Spec:** User request in this conversation.

## Global Constraints

- Preserve desktop and tablet layouts.
- Keep dense tables readable inside local touch-scroll containers.
- Do not add or run tests; verify compilation and inspect the diff.

## Review Focus

- Short phone and landscape viewports must still allow reaching Login and Register in the landing drawer.
- Dense clinic tables must scroll within their own panels without widening the page.
- Skeleton grids and chart placeholders must not preserve desktop-only column widths on phones.
- Existing changes in the working tree must remain untouched.

### Task 1: Landing mobile drawer

**Files:** `frontend/src/views/public/Home.vue`

- [ ] Use dynamic viewport height with a fallback, constrain the drawer to the viewport, and allow its content region to shrink and scroll independently.
- [ ] Keep the close header fixed within the drawer and ensure bottom safe-area padding does not hide Login or Register.

### Task 2: Shared responsive tables, charts, and skeletons

**Files:** `frontend/src/style.css`, `frontend/src/components/sidebar/BaseCollapsibleSidebar.vue`, `frontend/src/components/common/Table.vue`, `frontend/src/components/common/TablePagination.vue`, `frontend/src/components/common/Modal.vue`, `frontend/src/components/common/PageSectionSkeleton.vue`, `frontend/src/components/common/PageSkeleton.vue`

- [ ] Preserve intentional table minimum widths while ensuring overflow remains local to table wrappers.
- [ ] Collapse multi-column cards and chart panels on narrow screens; constrain chart canvases and skeleton content to their parent width.
- [ ] Make table skeletons follow the same local scrolling behavior as loaded dense tables.
- [ ] Keep shared dialogs inside the dynamic mobile viewport and make their content region scrollable.
- [ ] Keep mobile sidebars within the visible viewport so their navigation scrolls without hiding account controls.

### Task 3: Verification

- [ ] Run the frontend production build and `git diff --check`.
- [ ] Inspect the final diff and confirm unrelated existing edits remain present.
