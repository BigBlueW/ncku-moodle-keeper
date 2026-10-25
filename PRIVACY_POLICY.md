# Privacy Policy for NCKU Moodle Keeper

Last updated: October 25, 2026

Your privacy is important to us. This privacy policy explains how **NCKU Moodle Keeper** (the "Extension") handles your data.

## 1. Data the Extension Handles
**The developer of NCKU Moodle Keeper does not collect, receive, or transmit any user data.** No data is ever sent to the developer or to any server operated by the developer. The Extension handles the following data only inside your browser:

- **Captcha images (website content)**: On supported NCKU login pages, the captcha image is read and recognized entirely on your device. The image and the recognized code are not stored or sent anywhere; the code is only filled into the page's captcha field.
- **Moodle session renewal**: The Extension periodically requests the Moodle page you already have open so that your login session stays active. It does not read your password or any login credentials.
- **Sticky notes (website content and web history)**: Each sticky note you create contains:
  - the text you type, or text you selected on the page when creating it;
  - its color, size and position on the page;
  - the address (URL), title, course name and breadcrumb path of the Moodle page it was placed on, so it can be shown on that page and listed in the notes panel;
  - when it was created and last edited.

  Notes are saved with your browser's built-in extension storage (`chrome.storage.sync`). If browser sync is turned on, your browser provider (e.g. Google for Chrome, Mozilla for Firefox) syncs this data between your own devices as part of your browser account, under that provider's privacy policy. The developer never receives or has access to it. Deleting a note removes it from this storage.

The Extension never handles your password or other authentication credentials, and does not record pages you visit other than the Moodle pages where you choose to place a sticky note.

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
