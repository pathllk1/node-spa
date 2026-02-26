/**
 * TOAST NOTIFICATION UTILITY
 * Displays toast messages for success, error, and warning notifications
 */

export function showToast(message, type = 'success') {
    const bgColor = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    window.Toastify({ 
        text: message, 
        backgroundColor: bgColor, 
        duration: 3000,
        gravity: 'top',
        position: 'right',
        close: true
    }).showToast();
}
