import { logout } from '../../services';

export async function logoutPage(): Promise<string> {
  await logout();
  return `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-4">Logged Out Successfully</h2>
      <button onclick="navigate('/login')" class="w-full bg-blue-500 p-2 rounded">Login Again</button>
    </div>
  `;
}
