export function showRematchInvitation(inviterName: string, gameId: string, gameSettings: any): void {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg border z-50 max-w-sm';
  notification.innerHTML = `
    <h4 class="font-bold mb-2 text-gray-800">Rematch Invitation</h4>
    <p class="text-gray-600 mb-3">${inviterName} wants a rematch!</p>
    <div class="flex justify-between">
      <button id="accept-rematch" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">✓ Accept</button>
      <button id="decline-rematch" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">✗ Decline</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  const rematchBtn = document.getElementById('rematch');
  if (rematchBtn) rematchBtn.style.display = 'none';
  
  document.getElementById('accept-rematch')?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/pong/game/invitation/accept/${gameId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }
      notification.remove();
    } catch (error) {
      console.error('Error accepting rematch:', error);
      alert('Failed to accept rematch invitation');
      notification.remove();
    }
  });
  
  document.getElementById('decline-rematch')?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`/api/pong/game/invitation/decline/${gameId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
      });
      
      notification.remove();
      const rematchBtn = document.getElementById('rematch');
      if (rematchBtn) rematchBtn.style.display = 'block';
      (window as any).navigate('/play');
    } catch (error) {
      console.error('Error declining rematch:', error);
      notification.remove();
    }
  });
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
      const rematchBtn = document.getElementById('rematch');
      if (rematchBtn) rematchBtn.style.display = 'block';
    }
  }, 30000);
}

