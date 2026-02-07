
document.addEventListener('DOMContentLoaded', () => {
    const requestBtn = document.getElementById('requestPermissionBtn');
    const statusMsg = document.getElementById('statusMessage');
    const successMsg = document.getElementById('successMessage');
    const errorMsg = document.getElementById('errorMessage');

    requestBtn.addEventListener('click', async () => {
        requestBtn.disabled = true;
        requestBtn.textContent = 'Requesting...';
        statusMsg.textContent = 'Please check for a permission prompt...';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Permission granted! Stop stream immediately
            stream.getTracks().forEach(track => track.stop());

            // Save state
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ voiceEnabled: true }, () => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve();
                });
            });

            // Update UI
            requestBtn.style.display = 'none';
            statusMsg.style.display = 'none';
            successMsg.style.display = 'block';

            // Auto close after 3 seconds
            setTimeout(() => {
                window.close();
            }, 3000);

        } catch (error) {
            console.error('Permission error:', error);

            requestBtn.disabled = false;
            requestBtn.textContent = 'Try Again';
            statusMsg.textContent = '';

            errorMsg.style.display = 'block';
            errorMsg.querySelector('p').textContent = `Error: ${error.name} - ${error.message}`;
        }
    });
});
