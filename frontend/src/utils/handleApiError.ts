// utils/handleApiError.ts
export function handleApiError(error: any): never {
  if (error?.status === 429) {
    showRateLimitModal(error);
    throw new Error('Rate limit exceeded');
  }
  
  const message = error?.message || 'An unexpected error occurred';
  throw new Error(message);
}

export function showRateLimitModal(error: any) {
  const existingModal = document.getElementById('rate-limit-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const expiresIn = error?.expiresIn || 30;
  
  const modal = document.createElement('div');
  modal.id = 'rate-limit-modal';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.8); display: flex; align-items: center; 
                justify-content: center; z-index: 1000;">
      <div style="background: #1f2937; padding: 2rem; border-radius: 10px; text-align: center; color: white;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">⏰ Too Many Requests</h2>
        <p style="margin-bottom: 1.5rem;">You've made too many requests too quickly.</p>
        <div style="font-size: 1.2rem; font-weight: bold; margin: 1rem 0;">
          Retry in <span id="rate-limit-seconds">${expiresIn}</span> seconds
        </div>
        <p>Please wait a moment before trying again.</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  let seconds = expiresIn;
  const countdownEl = document.getElementById('rate-limit-seconds');
  const interval = setInterval(() => {
    seconds--;
    if (countdownEl) {
      countdownEl.textContent = seconds.toString();
    }
    
    if (seconds <= 0) {
      clearInterval(interval);
      modal.remove();
    }
  }, 1000);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      clearInterval(interval);
      modal.remove();
    }
  });
}
