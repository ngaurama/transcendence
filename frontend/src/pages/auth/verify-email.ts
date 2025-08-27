export async function verifyEmailPage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (!token) {
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4 text-red-400">Invalid Verification Link</h2>
        <p class="mb-4">The email verification link is invalid or missing.</p>
        <button onclick="navigate('/login')" class="w-full bg-blue-500 p-2 rounded">Go to Login</button>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (data.success) {
      return `
        <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
          <h2 class="text-2xl mb-4 text-green-400">Email Verified Successfully!</h2>
          <p class="mb-4">Your email has been verified. You can now login to your account.</p>
          <button onclick="navigate('/login?message=email_verified')" class="w-full bg-blue-500 p- hjeml rounded">
            Go to Login
          </button>
        </div>
      `;
    } else {
      return `
        <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
          <h2 class="text-2xl mb-4 text-red-400">Verification Failed</h2>
          <p class="mb-4">${data.error || 'Email verification failed'}</p>
          <div class="space-y-2">
            <button onclick="navigate('/login')" class="w-full bg-blue-500 p-2 rounded">
              Go to Login
            </button>
            <button onclick="navigate('/register')" class="w-full bg-green-500 p-2 rounded">
              Create New Account
            </button>
          </div>
        </div>
      `;
    }
  } catch (error) {
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4 text-red-400">Verification Error</h2>
        <p class="mb-4">There was an error verifying your email. Please try again later.</p>
        <button onclick="navigate('/login')" class="w-full bg-blue-500 p-2 rounded">Go to Login</button>
      </div>
    `;
  }
}
