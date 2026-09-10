import Swal from 'sweetalert2'

// Keep system-admin confirmations consistent with the application's logout dialog.
export const systemAdminSwal = Swal.mixin({
  customClass: {
    popup: 'swal-admin-popup',
    title: 'swal-admin-title',
    htmlContainer: 'swal-admin-text',
    icon: 'swal-admin-icon',
    confirmButton: 'swal-admin-confirm',
    cancelButton: 'swal-admin-cancel',
    denyButton: 'swal-admin-cancel',
  },
  buttonsStyling: false,
})

