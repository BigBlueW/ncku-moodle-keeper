/**
 * Minimal chrome.* stand-in so the sticky notes content scripts can run on a
 * plain page (see notes-playground.html).
 * - storage.sync is backed by localStorage; edits in another tab arrive
 *   through onChanged, like a sync from another device
 * - Alt + right-click stands in for the "Add sticky note here" menu item
 */
(() => {
    'use strict';

    const STORAGE_KEY = 'ncku-shim-storage';
    const lang = new URLSearchParams(location.search).get('lang') || 'zh_TW';
    const messageListeners = [];
    const changeListeners = [];

    const read = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const write = all => localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    const emit = changes => {
        if (Object.keys(changes).length) setTimeout(() => changeListeners.forEach(fn => fn(changes, 'sync')));
    };

    const sync = {
        QUOTA_BYTES: 102400,
        async get(keys) {
            const all = read();
            if (keys == null) return all;
            const wanted = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
            return Object.fromEntries(wanted.filter(k => k in all).map(k => [k, all[k]]));
        },
        async set(items) {
            const all = read();
            const changes = {};
            for (const [key, value] of Object.entries(items)) {
                const copy = structuredClone(value);
                changes[key] = { oldValue: all[key], newValue: copy };
                all[key] = copy;
            }
            write(all);
            emit(changes);
        },
        async remove(keys) {
            const all = read();
            const changes = {};
            for (const key of [].concat(keys)) {
                if (!(key in all)) continue;
                changes[key] = { oldValue: all[key] };
                delete all[key];
            }
            write(all);
            emit(changes);
        },
        async getBytesInUse() {
            return Object.entries(read()).reduce((sum, [k, v]) =>
                sum + new TextEncoder().encode(k + JSON.stringify(v)).length, 0);
        }
    };

    window.addEventListener('storage', e => {
        if (e.key !== STORAGE_KEY) return;
        const before = JSON.parse(e.oldValue || '{}');
        const after = JSON.parse(e.newValue || '{}');
        const changes = {};
        new Set([...Object.keys(before), ...Object.keys(after)]).forEach(key => {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                changes[key] = { oldValue: before[key], newValue: after[key] };
            }
        });
        emit(changes);
    });

    // Synchronous so the content scripts can call getMessage right away
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `../src/_locales/${lang}/messages.json`, false);
    xhr.send();
    const messages = JSON.parse(xhr.responseText);

    window.chrome = Object.assign(window.chrome || {}, {
        storage: { sync, onChanged: { addListener: fn => changeListeners.push(fn) } },
        i18n: {
            getMessage(key, subs = []) {
                const entry = messages[key];
                return entry ? entry.message.replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? '') : '';
            }
        },
        runtime: { onMessage: { addListener: fn => messageListeners.push(fn) } }
    });

    // Bubble phase on window, so the content script's capture listener runs first
    window.addEventListener('contextmenu', e => {
        if (!e.altKey) return;
        e.preventDefault();
        messageListeners.forEach(fn => fn({ type: 'add-sticky-note', selectionText: '' }));
    });
})();
