const RENEW_INTERVAL = 9 * 60 * 1000; // 9 minutes
const STORAGE_KEY = 'ncku-moodle-keeper-last-ping';
const TARGET_BUTTON_SELECTOR = [
    'value="延長連線時間"',
    'value="Extend session"',
    'value="延长连接时间"',
    'value="延長"',
].map(val => `input[type="button"].btn.btn-primary[${val}]`).join(', ');

/**
 * Proactively renews the session if it's been long enough since the last renew.
 * Uses localStorage to coordinate between multiple open Moodle tabs.
 */
function renewSession() {
    const now = Date.now();
    const lastPing = parseInt(localStorage.getItem(STORAGE_KEY) || '0');

    // Only one tab needs to renew the session
    if (now - lastPing < RENEW_INTERVAL) return;

    // "Claim" the renew task by updating the timestamp immediately
    localStorage.setItem(STORAGE_KEY, now.toString());

    fetch(window.location.href, { method: 'HEAD', cache: 'no-cache' })
        .then(response => {
            if (response.ok) {
                console.log(`[NCKU Moodle Keeper] Session touched at ${new Date().toLocaleTimeString()}`);
            }
        })
        .catch(() => {
            // On failure, reset timer slightly early to let another tab try soon
            localStorage.setItem(STORAGE_KEY, (now - RENEW_INTERVAL + 60000).toString());
        });
}

/**
 * Clicks the "Extend Session" button if it appears in a popup.
 */
function clickExtendButton() {
    const extendButton = document.querySelector(TARGET_BUTTON_SELECTOR);
    if (extendButton) {
        extendButton.click();
        console.log('[NCKU Moodle Keeper] Extend button clicked automatically.');
    }
}

// Proactive rhythm
setInterval(renewSession, 30 * 1000); // Check every 30s
renewSession(); // Immediate check on load

// Reactive rhythm (MutationObserver for popups)
const observer = new MutationObserver((mutations) => {
    // Only check if nodes were actually added to avoid over-calculating
    const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
    if (hasAddedNodes) {
        clickExtendButton();
    }
});

observer.observe(document.body, { childList: true, subtree: true });
clickExtendButton(); // Check once on load
