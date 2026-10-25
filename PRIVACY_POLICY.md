# Privacy Policy for NCKU Moodle Keeper

Last updated: October 25, 2026

Your privacy is important to us. This privacy policy explains how **NCKU Moodle Keeper** (the "Extension") handles your data.

## 1. No Data Collection
**The developer of NCKU Moodle Keeper does not collect, receive, or transmit any user data.**
- All processes, including session renewal and captcha recognition, happen entirely on your local machine within the browser.
- No personal information, browsing history, or authentication credentials (passwords) are ever sent to an external server or stored by the developer.
- **Sticky notes** you create are saved with your browser's built-in extension storage (`chrome.storage.sync`). Each note contains its text, color, position, and the Moodle page and course it belongs to. If browser sync is enabled, your browser provider (e.g. Google for Chrome, Mozilla for Firefox) syncs this data between your own devices as part of your browser account. The developer never receives or has access to it. Deleting a note removes it from this storage.

## 2. Permissions Justification
The Extension requires the following permissions to function:
- **Host Permission (`*://*.ncku.edu.tw/*`)**: Used solely to detect captcha images on NCKU login pages, to perform background pings to keep the NCKU Moodle session active, and to show sticky notes on NCKU Moodle pages.
- **`storage`**: Used to save your sticky notes in your browser.
- **`contextMenus`**: Used to add the "Add sticky note here" item to the right-click menu on NCKU Moodle pages.

## 3. Third-Party Services
The Extension does not use any third-party analytics or tracking services (such as Google Analytics).

## 4. Changes to This Policy
We may update our Privacy Policy from time to time. Any changes will be posted on this page.

## 5. Contact Us
If you have any questions about this Privacy Policy, you can reach out via the GitHub Issues page for this project.
