import Swal from 'sweetalert2'

// Use the shared global SweetAlert theme for system-admin dialogs too.
export const systemAdminSwal = Swal.mixin({
  // The shared theme styles SweetAlert's native `.swal2-styled` buttons.
  // Keeping this enabled prevents unstyled fallback buttons in admin dialogs.
  buttonsStyling: true,
})
