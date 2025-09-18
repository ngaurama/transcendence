export async function checkSMTPStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch('/api/auth/smtp-status');
    return await res.json();
  } catch (error) {
    return { configured: false };
  }
}

export function showSMTPFallbackNotification(token: string, type: 'verification' | 'reset') {
  const baseUrl = window.location.origin;
  const link = type === 'verification' 
    ? `${baseUrl}/verify-email?token=${token}`
    : `${baseUrl}/reset-password?token=${token}`;
  
  const message = type === 'verification' 
    ? `Your verification link is:`
    : `Your password reset link is:`;
  
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-yellow-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md break-words';
  notification.innerHTML = `
    <div class="flex justify-between items-start">
        <div>
        <h3 class="font-bold mb-2">SMTP Not Configured</h3>
        <p class="text-sm mb-2 whitespace-normal break-words">${message}</p>
        <a href="${link}" class="text-blue-200 hover:text-blue-100 underline break-words text-md block mb-2">
            Click here
        </a>
        <p class="text-xs mt-2">This is for demonstration only. Configure SMTP for production use.</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
        ×
        </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 15000);
}

