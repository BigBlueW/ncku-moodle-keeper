const ADD_NOTE_MENU_ID = 'add-sticky-note';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: ADD_NOTE_MENU_ID,
            title: chrome.i18n.getMessage('menuAddNote'),
            contexts: ['page', 'selection', 'link', 'image', 'editable'],
            documentUrlPatterns: ['*://moodle.ncku.edu.tw/*']
        });
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== ADD_NOTE_MENU_ID || !tab || tab.id === undefined) return;
    // Notes live in the top frame only
    if (info.frameId) return;
    chrome.tabs.sendMessage(tab.id, { type: 'add-sticky-note', selectionText: info.selectionText || '' }, () => {
        // The page may have been loaded before the extension was installed or updated
        void chrome.runtime.lastError;
    });
});
