import { changePassword } from '../../services';

export function changePasswordPage(): string {
  return `
    <div class="glass-card max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Change Password</h2>
      <form id="change-password-form" class="space-y-4">
        <input type="password" id="current-password" placeholder="Current Password" class="w-full p-2 bg-gray-700 rounded" required>
        <input type="password" id="new-password" placeholder="New Password" class="w-full p-2 bg-gray-700 rounded" minlength="6" required>
        <input type="password" id="confirm-new-password" placeholder="Confirm New Password" class="w-full p-2 bg-gray-700 rounded" minlength="6" required>
        <button type="submit" class="glass-button w-full bg-blue-500 p-2 rounded">Change Password</button>
      </form>
    </div>
  `;
}

export function attachChangePasswordListeners() {
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('access_token');
        const currentPassword = (document.getElementById('current-password') as HTMLInputElement).value;
        const newPassword = (document.getElementById('new-password') as HTMLInputElement).value;
        const confirmPassword = (document.getElementById('confirm-new-password') as HTMLInputElement).value;

        if (!token) {
            alert('Please login first');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }

        if (newPassword === currentPassword) {
            alert('New password cannot be the same as old password');
            return;
        }

        try {
            await changePassword(token, currentPassword, newPassword);
            alert('Password changed successfully');
            (window as any).navigate('/');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to change password');
        }
        });
    }
}
