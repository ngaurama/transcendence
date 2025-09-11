import { checkAuthStatus } from "../../services";

export async function gdprPage(): Promise<string> {
  const user = await checkAuthStatus();
  if (!user) {
    (window as any).navigate('/');
    return '';
  }

  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'local';

  return `
    <div class="glass-card max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
      <!-- Back Arrow -->
      <div class="mb-4">
        <button onclick="navigateBack()" class="flex items-center text-gray-400 hover:text-white transition-colors">
          <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>
      <h2 class="text-2xl mb-6">GDPR Compliance Center</h2>

      <!-- Add pending deletion status -->
      <div id="deletion-status" class="glass-card hidden bg-yellow-900 bg-opacity-20 p-4 rounded mb-4">
        <h3 class="text-lg font-semibold mb-2">Pending Account Deletion</h3>
        <p class="text-gray-300" id="deletion-date"></p>
        <button id="cancel-deletion" class="glass-button mt-2 bg-green-600 px-3 py-1 rounded text-sm">
          Cancel Deletion Request
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Data Management Card -->
        <div class="glass-card bg-gray-900 p-4 rounded">
          <h3 class="text-lg font-semibold mb-3">Data Management</h3>
          <p class="text-gray-400 mb-4">Manage your personal information and data</p>
          
          <button onclick="navigate('/view-data')" class="glass-button w-full bg-blue-600 p-2 rounded mb-2">
            View My Data
          </button>
          
          <button onclick="navigate('/export-data')" class="glass-button w-full bg-purple-600 p-2 rounded mb-2">
            Export My Data
          </button>
        </div>

        <!-- Privacy Actions Card -->
        <div class="glass-card bg-gray-900 p-${isOAuthUser ? 2 : 3} rounded">
          <h3 class="text-lg font-semibold mb-3">Privacy Actions</h3>
          <p class="text-gray-400 mb-4">Exercise your privacy rights</p>
          ${!isOAuthUser ? `
            <button onclick="navigate('/anonymize-account')" class="glass-button w-full bg-orange-600 p-2 rounded mb-2">
              Anonymize Account
            </button>
            ` : '' 
          }
          
          <button onclick="navigate('/delete-account')" class="w-full glass-button bg-red-600 p-2 rounded">
            Delete Account
          </button>
        </div>
      </div>

      <!-- Information Section -->
      <div class="glass-card mt-6 bg-gray-900 p-4 rounded">
        <h3 class="text-lg font-semibold mb-3">Your Privacy Rights</h3>
        <div class="text-sm text-gray-400 space-y-2">
          <p>Under GDPR, you have the right to:</p>
          <ul class="list-disc list-inside ml-4">
            <li>Access your personal data</li>
            <li>Rectify inaccurate data</li>
            <li>Erase your personal data</li>
            <li>Restrict processing of your data</li>
            <li>Data portability</li>
            <li>Object to processing</li>
          </ul>
          <p class="mt-2">For more information, contact our Data Protection Officer at ft.transcendence.dev@gmail.com</p>
        </div>
      </div>
    </div>
  `;
}

export function viewDataPage(): string {
  return `
    <div class="glass-card max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6">View My Data</h2>
      
      <div id="user-data" class="bg-gray-900 p-4 rounded mb-4">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p class="mt-2 text-gray-400">Loading your data...</p>
        </div>
      </div>
      
      <button onclick="navigate('/gdpr')" class="glass-button bg-gray-600 px-4 py-2 rounded">
        Back to GDPR Center
      </button>
    </div>
  `;
}

export function exportDataPage(): string {
  return `
    <div class="glass-card max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6">Export My Data</h2>
      
      <div class="bg-gray-900 p-4 rounded mb-4">
        <p class="text-gray-400 mb-4">
          You can download a copy of all your personal data in JSON format. This includes:
        </p>
        <ul class="list-disc list-inside ml-4 text-gray-400 mb-4">
          <li>Account information</li>
          <li>Game statistics</li>
          <li>Friendship data</li>
          <li>Session history</li>
          <li>Tournament participation</li>
        </ul>
        
        <button id="export-btn" class="glass-button w-full bg-purple-600 p-2 rounded">
          Export My Data
        </button>
      </div>
      
      <div id="export-result" class="hidden"></div>
      
      <button onclick="navigate('/gdpr')" class="glass-button bg-gray-600 px-4 py-2 rounded">
        Back to GDPR Center
      </button>
    </div>
  `;
}

export function anonymizeAccountPage(): string {
  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-orange-400">Anonymize Account</h2>
      
      <div class="bg-orange-900 bg-opacity-20 p-4 rounded mb-4">
        <h3 class="text-lg font-semibold mb-2">⚠️ Important Notice</h3>
        <p class="text-gray-300 mb-2">
          Anonymizing your account will:
        </p>
        <ul class="list-disc list-inside ml-4 text-gray-300 mb-3">
          <li>Remove all personally identifiable information</li>
          <li>Replace your username and email with anonymous values</li>
          <li>Delete your avatar and authentication methods</li>
          <li>Permanently disable your account</li>
          <li>Preserve your game statistics in anonymized form</li>
        </ul>
        <p class="text-red-400 font-semibold">
          This action cannot be undone!
        </p>
      </div>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input type="checkbox" id="confirm-anonymize" class="mr-2">
          <span class="text-gray-300">I understand this action is irreversible</span>
        </label>
      </div>
      
      <button id="anonymize-btn" disabled class="glass-button w-full bg-orange-600 p-2 rounded opacity-50">
        Anonymize My Account
      </button>
      
      <div class="mt-4">
        <button onclick="navigate('/gdpr')" class="glass-button bg-gray-600 px-4 py-2 rounded">
          Back to GDPR Center
        </button>
      </div>
    </div>
  `;
}

export function deleteAccountPage(): string {
  return `
    <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg">
      <h2 class="text-2xl mb-6 text-red-500">Delete Account</h2>
      
      <div class="bg-red-900/50 bg-opacity-20 p-4 rounded mb-4">
        <h3 class="text-lg font-semibold mb-2">🚫 Permanent Deletion</h3>
        <p class="text-gray-300 mb-2">
          Deleting your account will:
        </p>
        <ul class="list-disc list-inside ml-4 text-gray-300 mb-3">
          <li>Schedule your account for permanent deletion</li>
          <li>Remove all your personal data after 30 days</li>
          <li>Delete all your game statistics and history</li>
          <li>Remove you from all tournaments and friendships</li>
          <li>Cancel any pending game invitations</li>
        </ul>
        <p class="text-red-400 font-semibold">
          This action is irreversible after the 30-day grace period!
        </p>
      </div>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input type="checkbox" id="confirm-delete" class="mr-2">
          <span class="text-gray-300">I understand my data will be permanently deleted</span>
        </label>
      </div>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input type="checkbox" id="confirm-understand" class="mr-2">
          <span class="text-gray-300">I understand this action cannot be undone</span>
        </label>
      </div>
      
      <button id="delete-btn" disabled class="glass-button w-full bg-red-600 p-2 rounded opacity-50">
        Delete My Account
      </button>
      
      <div class="mt-4">
        <button onclick="navigate('/gdpr')" class="glass-button bg-gray-600 px-4 py-2 rounded">
          Back to GDPR Center
        </button>
      </div>
    </div>
  `;
}

export function attachGdprListeners() {

  if (window.location.pathname === '/gdpr') {
    loadDeletionStatus();
  }

  if (window.location.pathname === '/view-data') {
    loadUserData();
  }

  if (window.location.pathname === '/export-data') {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleDataExport);
    }
  }

  if (window.location.pathname === '/anonymize-account') {
    const confirmCheckbox = document.getElementById('confirm-anonymize');
    const anonymizeBtn = document.getElementById('anonymize-btn');

    if (confirmCheckbox && anonymizeBtn) {
      confirmCheckbox.addEventListener('change', () => {
        anonymizeBtn.disabled = !confirmCheckbox.checked;
        anonymizeBtn.classList.toggle('opacity-50', !confirmCheckbox.checked);
      });

      anonymizeBtn.addEventListener('click', handleAnonymizeAccount);
    }
  }

  if (window.location.pathname === '/delete-account') {
    const confirmDelete = document.getElementById('confirm-delete');
    const confirmUnderstand = document.getElementById('confirm-understand');
    const deleteBtn = document.getElementById('delete-btn');

    if (confirmDelete && confirmUnderstand && deleteBtn) {
      const updateButtonState = () => {
        deleteBtn.disabled = !(confirmDelete.checked && confirmUnderstand.checked);
        deleteBtn.classList.toggle('opacity-50', !(confirmDelete.checked && confirmUnderstand.checked));
      };

      confirmDelete.addEventListener('change', updateButtonState);
      confirmUnderstand.addEventListener('change', updateButtonState);

      deleteBtn.addEventListener('click', handleDeleteAccount);
    }
  }
}

async function loadDeletionStatus() {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch('/api/auth/gdpr/deletion-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.pending_deletion) {
      const statusEl = document.getElementById('deletion-status');
      const dateEl = document.getElementById('deletion-date');
      const cancelBtn = document.getElementById('cancel-deletion');
      
      if (statusEl && dateEl && cancelBtn) {
        statusEl.classList.remove('hidden');
        dateEl.textContent = `Scheduled for deletion on: ${new Date(data.deletion_date + "Z").toLocaleDateString()}`;
        
        cancelBtn.addEventListener('click', async () => {
          if (confirm('Cancel account deletion request?')) {
            await cancelDeletionRequest();
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to load deletion status:', error);
  }
}

async function cancelDeletionRequest() {
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch('/api/auth/gdpr/cancel-deletion', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      alert('Deletion request cancelled successfully!');
      (window as any).navigate("/");
    }
  } catch (error) {
    alert('Failed to cancel deletion request');
  }
}

async function loadUserData() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      (window as any).navigate('/login');
      return;
    }

    const response = await fetch('/api/auth/gdpr/my-data', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    const container = document.getElementById('user-data');
    if (!container) return;

    if (data.success) {
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'View JSON';
      toggleBtn.className = 'glass-button mb-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600';
      
      const prettyDiv = document.createElement('div');
      prettyDiv.className = 'glass-card bg-gray-800 p-4 rounded space-y-2 text-sm text-gray-100';
      prettyDiv.innerHTML = `
        <div><strong>ID:</strong> ${data.data.id}</div>
        <div><strong>Username:</strong> ${data.data.username}</div>
        <div><strong>Email:</strong> ${data.data.email}</div>
        <div><strong>Display Name:</strong> ${data.data.display_name}</div>
        <div><strong>Avatar:</strong> <img src="${data.data.avatar_url}" class="w-12 h-12 rounded inline-block ml-2"></div>
        <div><strong>Verified:</strong> ${data.data.is_verified ? 'Yes' : 'No'}</div>
        <div><strong>OAuth Provider:</strong> ${data.data.oauth_provider || 'Local'}</div>
        <div><strong>2FA Enabled:</strong> ${data.data.totp_enabled ? 'Yes' : 'No'}</div>
        <div><strong>Created At:</strong> ${new Date(data.data.created_at + "Z").toLocaleString()}</div>
        <div><strong>Last Login:</strong> ${new Date(data.data.last_login_at + "Z").toLocaleString()}</div>
      `;
      const jsonDiv = document.createElement('pre');
      jsonDiv.className = 'bg-gray-900 p-4 rounded overflow-auto text-sm hidden';
      jsonDiv.textContent = JSON.stringify(data.data, null, 2);

      toggleBtn.addEventListener('click', () => {
        jsonDiv.classList.toggle('hidden');
        prettyDiv.classList.toggle('hidden');
        toggleBtn.textContent = jsonDiv.classList.contains('hidden') ? 'View JSON' : 'View Pretty';
      });

      container.innerHTML = '';
      container.appendChild(toggleBtn);
      container.appendChild(prettyDiv);
      container.appendChild(jsonDiv);

    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    const container = document.getElementById('user-data');
    if (container) {
      container.innerHTML = `
        <div class="text-red-400 p-4 bg-red-900 bg-opacity-20 rounded">
          Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }
}

async function handleDataExport() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      (window as any).navigate('/login');
      return;
    }

    const response = await fetch('/api/auth/gdpr/export-data', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ft-transcendence-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const resultDiv = document.getElementById('export-result');
      if (resultDiv) {
        resultDiv.innerHTML = `
          <div class="bg-green-900 bg-opacity-20 p-4 rounded text-green-400">
            Data export completed successfully. Download started automatically.
          </div>
        `;
        resultDiv.classList.remove('hidden');
      }
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    const resultDiv = document.getElementById('export-result');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="bg-red-900 bg-opacity-20 p-4 rounded text-red-400">
          Export failed: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
      resultDiv.classList.remove('hidden');
    }
  }
}

async function handleAnonymizeAccount() {
  if (!confirm('Are you absolutely sure you want to anonymize your account? This cannot be undone!')) {
    return;
  }

  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      (window as any).navigate('/login');
      return;
    }

    const response = await fetch('/api/auth/gdpr/anonymize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (data.success) {
      alert('Account successfully anonymized. You will be logged out.');
      localStorage.clear();
      (window as any).navigate('/');
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    alert(`Anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleDeleteAccount() {
  if (!confirm('Are you absolutely sure you want to delete your account? This action is irreversible after 30 days!')) {
    return;
  }

  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      (window as any).navigate('/login');
      return;
    }

    const response = await fetch('/api/auth/gdpr/account', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    if (data.success) {
      alert('Account deletion requested. You will be logged out. You have 30 days to cancel this request.');
      localStorage.clear();
      (window as any).navigate('/');
    } else {
      throw new Error(data.error || 'Deletion failed');
    }
  } catch (error) {
    alert(`Deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}