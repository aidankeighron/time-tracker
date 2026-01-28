document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('syncBtn');
    const statusDiv = document.getElementById('status');
  
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      statusDiv.textContent = 'Syncing...';
      
      try {
        const response = await chrome.runtime.sendMessage({ action: 'manual_sync' });
        
        if (response && response.success) {
          statusDiv.textContent = 'Sync Successful!';
          statusDiv.style.color = 'green';
        } else {
          statusDiv.textContent = 'Sync Failed: ' + (response ? response.error : 'Unknown');
          statusDiv.style.color = 'red';
        }
      } catch (err) {
        statusDiv.textContent = 'Error: ' + err.message;
        statusDiv.style.color = 'red';
      } finally {
        setTimeout(() => {
          syncBtn.disabled = false;
          if (statusDiv.textContent === 'Sync Successful!') {
             setTimeout(() => { statusDiv.textContent = ''; }, 3000);
          }
        }, 1000);
      }
    });
  });
