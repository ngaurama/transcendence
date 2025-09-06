export async function authCallbackPage(): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const provider = urlParams.get('provider');
  const access_token = urlParams.get('access_token');
  const refresh_token = urlParams.get('refresh_token');

  if (error) {
    if (error === 'account_mismatch') {
      return `
        <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
          <h2 class="text-2xl mb-4 text-red-400">Account Mismatch</h2>
          <p>This account was created via ${provider}. Please use ${provider} login.</p>
          <button onclick="navigate('/login')" class="glass-button w-full bg-blue-500 p-2 rounded mt-4">Back to Login</button>
        </div>
      `;
    }
    return `
      <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
        <h2 class="text-2xl mb-4 text-red-400">OAuth Error</h2>
        <p class="mb-4">${error}</p>
        <button onclick="navigate('/login')" class="glass-button w-full bg-blue-500 p-2 rounded">Back to Login</button>
      </div>
    `;
  }

  if (access_token && refresh_token) {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    (window as any).navigate('/');
    return '<h2>Logging in...</h2>';
  }

  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4 text-red-400">Invalid OAuth Callback</h2>
      <button onclick="navigate('/login')" class="glass-button w-full bg-blue-500 p-2 rounded">Back to Login</button>
    </div>
  `;
}
