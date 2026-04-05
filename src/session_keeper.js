const DEBUG = false;

const RENEW_INTERVAL = 9 * 60 * 1000; // 9 minutes
const CHECK_INTERVAL = 30 * 1000; // 30 seconds
const STORAGE_KEY = 'ncku-moodle-keeper-last-ping';

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
                if (DEBUG) console.log(`[NCKU Moodle Keeper] Session touched at ${new Date().toLocaleTimeString()}`);
            }
        })
        .catch(() => {
            // On failure, reset timer slightly early to let another tab try soon
            localStorage.setItem(STORAGE_KEY, (now - RENEW_INTERVAL + 60000).toString());
        });
}

// Proactive rhythm
setInterval(renewSession, CHECK_INTERVAL);
renewSession();
