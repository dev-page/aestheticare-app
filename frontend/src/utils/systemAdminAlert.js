import Swal from 'sweetalert2'

// Use the shared global SweetAlert theme for system-admin dialogs too.
export const systemAdminSwal = Swal.mixin({
  buttonsStyling: false,
})