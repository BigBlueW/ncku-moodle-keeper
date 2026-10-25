/**
 * Sticky notes for NCKU Moodle.
 * Right-click → "Add sticky note here" places a note anchored to the element
 * under the cursor, so it follows that element when the layout changes.
 * Notes live in chrome.storage.sync and follow the user across devices.
 * A "Sticky Notes" button in the Moodle front page icon bar lists every note.
 */

(function () {
    'use strict';

    const DEBUG = false;
    const LOG_PREFIX = '[NCKU Moodle Keeper]';

    const KEY_PREFIX = 'note:';
    const HASH_PREFIX = '#ncku-note-';
    const SAVE_DELAY_MS = 800;
    const RATE_LIMIT_RETRY_MS = 15000;
    const DELETE_CONFIRM_MS = 3000;
    const CONTEXT_MAX_AGE_MS = 60000;
    // storage.sync allows 8 KB per item (key + JSON value, in bytes)
    const MAX_ITEM_BYTES = 8000;
    const DEFAULT_WIDTH = 240;
    const MIN_WIDTH = 160;
    const COLORS = ['yellow', 'pink', 'green', 'blue', 'purple'];
    // Query parameters that don't change which page is shown
    const IGNORED_PARAMS = new Set(['lang', 'forceview']);
    // Ids Moodle regenerates on every page load, which can't anchor anything
    const UNSTABLE_ID = /yui_|[0-9a-f]{13}|^(action-menu|drop-?down|random|single_button|collapse|mform|id_|fitem_|fgroup_|ext-gen)/i;

    const storage = chrome.storage.sync;
    const md = NckuMarkdown;
    const t = (key, ...subs) => chrome.i18n.getMessage(key, subs) || key;

    const currentPage = normalizePage(location.href);
    const views = new Map(); // note id -> view
    let notesHost = null;
    let notesRoot = null;
    let panel = null;
    let lastContext = null;
    let layoutQueued = false;

    // ─── Page Identity ─────────────────────────────────────────────────────────

    function normalizePage(href) {
        const url = new URL(href);
        const params = [...url.searchParams]
            .filter(([key]) => !IGNORED_PARAMS.has(key))
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        const query = new URLSearchParams(params).toString();
        return url.host + url.pathname + (query ? `?${query}` : '');
    }

    function pageUrl() {
        const url = new URL(location.href);
        url.hash = '';
        return url.href;
    }

    function courseInfo() {
        const match = document.body.className.match(/\bcourse-(\d+)\b/);
        const courseId = match ? Number(match[1]) : 0;
        let courseName = '';
        if (courseId > 1) {
            const crumb = [...document.querySelectorAll('.breadcrumb a[href*="course/view.php"]')]
                .find(a => new URL(a.href).searchParams.get('id') === String(courseId));
            courseName = crumb ? crumb.textContent.trim() : '';
            if (!courseName && location.pathname === '/course/view.php') {
                const heading = document.querySelector('#page-header h1, .page-header-headings h1');
                courseName = heading ? heading.textContent.trim() : '';
            }
        }
        return { courseId, courseName };
    }

    // ─── Anchoring ─────────────────────────────────────────────────────────────

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function isStableAnchor(el) {
        return el.id && !UNSTABLE_ID.test(el.id) &&
            document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1 &&
            getComputedStyle(el).position !== 'fixed';
    }

    /**
     * Describes a page position relative to the nearest ancestor of `target`
     * with a stable id. The absolute position is kept as a fallback for when
     * that element no longer exists.
     */
    function anchorFor(target, pageX, pageY) {
        const anchor = { pageX: Math.round(pageX), pageY: Math.round(pageY) };
        let el = target;
        while (el && el !== document.body && el !== document.documentElement && !isStableAnchor(el)) {
            el = el.parentElement;
        }
        if (el && el !== document.body && el !== document.documentElement) {
            const rect = el.getBoundingClientRect();
            anchor.id = el.id;
            anchor.xRatio = rect.width ? clamp((pageX - rect.left - scrollX) / rect.width, 0, 1) : 0;
            anchor.dy = Math.round(pageY - rect.top - scrollY);
        }
        return anchor;
    }

    /** Returns the page position for an anchor, or null when its element is hidden. */
    function resolveAnchor(anchor) {
        if (anchor.id) {
            const el = document.getElementById(anchor.id);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return null;
                return { x: rect.left + scrollX + anchor.xRatio * rect.width, y: rect.top + scrollY + anchor.dy };
            }
        }
        return { x: anchor.pageX, y: anchor.pageY };
    }

    /** The topmost page element at a viewport point, looking through our own UI. */
    function pageElementAt(clientX, clientY) {
        const x = clamp(clientX, 0, document.documentElement.clientWidth - 1);
        const y = clamp(clientY, 0, document.documentElement.clientHeight - 1);
        return document.elementsFromPoint(x, y).find(el =>
            el !== notesHost && el !== (panel && panel.host) && el !== document.documentElement) || document.body;
    }

    // ─── Layout ────────────────────────────────────────────────────────────────

    function layoutNote(view) {
        if (view.dragging) return;
        const pos = resolveAnchor(view.data.anchor);
        view.el.hidden = !pos;
        if (!pos) return;
        const maxX = Math.max(0, document.documentElement.clientWidth - view.el.offsetWidth - 4);
        view.el.style.left = `${Math.round(clamp(pos.x, 0, maxX))}px`;
        view.el.style.top = `${Math.round(Math.max(0, pos.y))}px`;
    }

    function scheduleLayout() {
        if (layoutQueued) return;
        layoutQueued = true;
        requestAnimationFrame(() => {
            layoutQueued = false;
            views.forEach(layoutNote);
        });
    }

    function watchLayout() {
        // Moodle expands / collapses sections, drawers and blocks without
        // resizing the window, so watch the DOM too
        new MutationObserver(scheduleLayout).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'open']
        });
        new ResizeObserver(scheduleLayout).observe(document.body);
        window.addEventListener('resize', scheduleLayout);
        window.addEventListener('load', scheduleLayout);
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    function newId() {
        return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }

    function scheduleSave(view, delay = SAVE_DELAY_MS) {
        clearTimeout(view.saveTimer);
        view.saveTimer = setTimeout(() => saveNote(view), delay);
    }

    async function saveNote(view) {
        clearTimeout(view.saveTimer);
        view.saveTimer = null;
        const data = view.data;
        // Empty notes only exist while being written
        if (!data.text.trim() || !views.has(data.id)) return;

        Object.assign(data, courseInfo(), { pageTitle: document.title, url: pageUrl(), updated: Date.now() });
        const key = KEY_PREFIX + data.id;
        if (new TextEncoder().encode(key + JSON.stringify(data)).length > MAX_ITEM_BYTES) {
            setStatus(view, t('noteTooLong'));
            return;
        }

        try {
            await storage.set({ [key]: data });
            setStatus(view, '');
        } catch (err) {
            const message = String(err && err.message || err);
            if (/MAX_WRITE_OPERATIONS/.test(message)) {
                scheduleSave(view, RATE_LIMIT_RETRY_MS);
            } else {
                setStatus(view, /QUOTA_BYTES/.test(message) ? t('noteQuotaFull') : t('noteSaveFailed', message));
            }
            if (DEBUG) console.warn(`${LOG_PREFIX} Failed to save note:`, err);
        }
    }

    function flushSaves() {
        views.forEach(view => {
            if (view.editing) view.data.text = view.editor.value;
            if (view.saveTimer) saveNote(view);
        });
    }

    async function loadAllNotes() {
        const all = await storage.get(null);
        return Object.entries(all)
            .filter(([key]) => key.startsWith(KEY_PREFIX))
            .map(([, data]) => data);
    }

    // ─── Note Element ──────────────────────────────────────────────────────────

    function ensureNotesRoot() {
        if (notesRoot) return notesRoot;
        notesHost = document.createElement('ncku-sticky-notes');
        // Below Bootstrap dropdowns (1000) and Moodle's fixed navbar (1030)
        notesHost.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:990;';
        notesRoot = notesHost.attachShadow({ mode: 'open' });
        notesRoot.innerHTML = `<style>${NOTE_CSS}</style>`;
        isolateKeyboard(notesHost);
        // Outside <body> so Moodle's layout and our MutationObserver ignore it
        document.documentElement.appendChild(notesHost);
        return notesRoot;
    }

    function isolateKeyboard(host) {
        // Keep typing inside our UI from triggering page shortcuts
        ['keydown', 'keyup', 'keypress'].forEach(type =>
            host.addEventListener(type, e => e.stopPropagation()));
    }

    function addView(data) {
        const view = { data, editing: false, dragging: false, saveTimer: null, suppressClick: false };
        view.el = buildNoteElement(view);
        view.editor = view.el.querySelector('.editor');
        views.set(data.id, view);
        ensureNotesRoot().appendChild(view.el);
        renderNote(view);
        layoutNote(view);
        return view;
    }

    function removeView(view) {
        clearTimeout(view.saveTimer);
        view.resizeObserver.disconnect();
        view.el.remove();
        views.delete(view.data.id);
    }

    function buildNoteElement(view) {
        const esc = md.escapeHtml;
        const el = document.createElement('div');
        el.className = 'note';
        el.innerHTML = `
            <div class="bar">
                <button type="button" class="tool color" title="${esc(t('noteColor'))}"></button>
                <div class="grip"></div>
                <button type="button" class="tool collapse" title="${esc(t('noteCollapse'))}">${ICON_MINUS}</button>
                <button type="button" class="tool delete" title="${esc(t('noteDelete'))}">${ICON_CLOSE}</button>
            </div>
            <div class="palette" hidden>
                ${COLORS.map(c => `<button type="button" class="swatch" data-color="${c}"></button>`).join('')}
            </div>
            <div class="content md"></div>
            <textarea class="editor" hidden placeholder="${esc(t('notePlaceholder'))}"></textarea>
            <div class="status" hidden></div>
            <button type="button" class="chip" title="${esc(t('noteExpand'))}">${ICON_NOTE}</button>`;

        const $ = selector => el.querySelector(selector);
        const editor = $('.editor');
        const palette = $('.palette');

        $('.bar').addEventListener('pointerdown', e => {
            if (!e.target.closest('.tool')) startDrag(view, e);
        });
        // Clicking the bar or its buttons must not take focus from the editor
        $('.bar').addEventListener('mousedown', e => e.preventDefault());
        $('.chip').addEventListener('pointerdown', e => startDrag(view, e));
        $('.chip').addEventListener('click', () => {
            if (view.suppressClick) { view.suppressClick = false; return; }
            setCollapsed(view, false);
        });

        $('.color').addEventListener('click', () => { palette.hidden = !palette.hidden; });
        palette.addEventListener('click', e => {
            const swatch = e.target.closest('.swatch');
            if (!swatch) return;
            view.data.color = swatch.dataset.color;
            palette.hidden = true;
            renderNote(view);
            saveNote(view);
        });

        $('.collapse').addEventListener('click', () => setCollapsed(view, true));

        const deleteButton = $('.delete');
        let confirmTimer = null;
        deleteButton.addEventListener('click', () => {
            if (!view.data.text.trim() || deleteButton.classList.contains('confirm')) {
                clearTimeout(confirmTimer);
                deleteNote(view);
                return;
            }
            deleteButton.classList.add('confirm');
            deleteButton.title = t('noteDeleteConfirm');
            confirmTimer = setTimeout(() => {
                deleteButton.classList.remove('confirm');
                deleteButton.title = t('noteDelete');
            }, DELETE_CONFIRM_MS);
        });

        $('.content').addEventListener('click', e => {
            if (e.target.closest('a')) return;
            const checkbox = e.target.closest('input[type="checkbox"]');
            if (checkbox) {
                view.data.text = md.toggleTask(view.data.text, Number(checkbox.dataset.line));
                renderNote(view);
                saveNote(view);
                return;
            }
            enterEdit(view);
        });

        editor.addEventListener('input', () => {
            view.data.text = editor.value;
            autosize(editor);
            scheduleSave(view);
        });
        editor.addEventListener('keydown', e => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                editor.blur();
            }
        });
        editor.addEventListener('blur', () => {
            // Switching to another window or tab keeps the note in edit mode
            if (document.hasFocus()) exitEdit(view);
        });

        // Persist the width after the user drags the resize handle
        view.resizeObserver = new ResizeObserver(() => {
            const width = Math.round(el.offsetWidth);
            if (view.data.collapsed || el.hidden || width < MIN_WIDTH || Math.abs(width - view.data.width) < 2) return;
            view.data.width = width;
            scheduleSave(view);
        });
        view.resizeObserver.observe(el);

        return el;
    }

    function renderNote(view) {
        const { el, data } = view;
        el.dataset.color = COLORS.includes(data.color) ? data.color : COLORS[0];
        el.classList.toggle('collapsed', !!data.collapsed);
        el.style.width = data.collapsed ? '' : `${Math.max(MIN_WIDTH, data.width || DEFAULT_WIDTH)}px`;
        el.querySelector('.chip').title = md.toPlainText(data.text).slice(0, 80) || t('noteExpand');
        if (!view.editing) el.querySelector('.content').innerHTML = md.render(data.text);
    }

    function setStatus(view, message) {
        const status = view.el.querySelector('.status');
        status.textContent = message;
        status.hidden = !message;
    }

    function autosize(editor) {
        editor.style.height = 'auto';
        editor.style.height = `${editor.scrollHeight}px`;
    }

    function enterEdit(view) {
        if (view.editing) return;
        view.editing = true;
        view.el.classList.add('editing');
        view.el.querySelector('.content').hidden = true;
        view.editor.hidden = false;
        view.editor.value = view.data.text;
        autosize(view.editor);
        view.editor.focus();
        view.editor.setSelectionRange(view.editor.value.length, view.editor.value.length);
    }

    function exitEdit(view) {
        if (!view.editing) return;
        view.editing = false;
        view.el.classList.remove('editing');
        view.data.text = view.editor.value;
        if (!view.data.text.trim()) {
            deleteNote(view);
            return;
        }
        view.editor.hidden = true;
        view.el.querySelector('.content').hidden = false;
        renderNote(view);
        // A pending timer means there are unsaved edits
        if (view.saveTimer) saveNote(view);
    }

    function setCollapsed(view, collapsed) {
        if (view.editing) view.editor.blur();
        if (!views.has(view.data.id)) return; // blur removed an empty note
        view.data.collapsed = collapsed;
        view.el.querySelector('.palette').hidden = true;
        renderNote(view);
        layoutNote(view);
        saveNote(view);
    }

    async function deleteNote(view) {
        removeView(view);
        try {
            await storage.remove(KEY_PREFIX + view.data.id);
        } catch (err) {
            console.error(`${LOG_PREFIX} Failed to delete note:`, err);
        }
    }

    // ─── Dragging ──────────────────────────────────────────────────────────────

    function startDrag(view, e) {
        if (e.button !== 0) return;
        // Keeps focus (and edit mode) in the editor while dragging
        e.preventDefault();
        const handle = e.currentTarget;
        const el = view.el;
        const startX = e.clientX, startY = e.clientY;
        const originLeft = parseFloat(el.style.left) || 0;
        const originTop = parseFloat(el.style.top) || 0;
        let moved = false;

        handle.setPointerCapture(e.pointerId);

        const onMove = ev => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (!moved && Math.hypot(dx, dy) < 4) return;
            moved = true;
            view.dragging = true;
            el.classList.add('dragging');
            el.style.left = `${Math.max(0, originLeft + dx)}px`;
            el.style.top = `${Math.max(0, originTop + dy)}px`;
        };

        const onEnd = () => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onEnd);
            handle.removeEventListener('pointercancel', onEnd);
            view.dragging = false;
            el.classList.remove('dragging');
            if (!moved) return;

            if (handle.classList.contains('chip')) view.suppressClick = true;
            // Re-anchor to whatever now sits under the note's top-left corner
            const rect = el.getBoundingClientRect();
            const target = pageElementAt(rect.left + 1, rect.top + 1);
            view.data.anchor = anchorFor(target, rect.left + scrollX, rect.top + scrollY);
            layoutNote(view);
            saveNote(view);
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onEnd);
        handle.addEventListener('pointercancel', onEnd);
    }

    // ─── Creating Notes ────────────────────────────────────────────────────────

    function rememberContext(e) {
        lastContext = {
            target: e.target,
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            selection: String(window.getSelection() || '').trim(),
            time: Date.now()
        };
    }

    function createNote(selectionText) {
        const ctx = lastContext && Date.now() - lastContext.time < CONTEXT_MAX_AGE_MS ? lastContext : null;
        lastContext = null;

        let target, pageX, pageY;
        if (ctx) {
            pageX = ctx.pageX;
            pageY = ctx.pageY;
            // Right-clicking on one of our notes reports the shadow host
            target = ctx.target === notesHost ? pageElementAt(ctx.clientX, ctx.clientY) : ctx.target;
        } else {
            const clientX = innerWidth / 2 - DEFAULT_WIDTH / 2, clientY = innerHeight / 3;
            pageX = clientX + scrollX;
            pageY = clientY + scrollY;
            target = pageElementAt(clientX, clientY);
        }

        const now = Date.now();
        const view = addView({
            id: newId(),
            page: currentPage,
            url: pageUrl(),
            pageTitle: document.title,
            ...courseInfo(),
            text: (ctx && ctx.selection) || selectionText.trim(),
            color: COLORS[0],
            collapsed: false,
            width: DEFAULT_WIDTH,
            anchor: anchorFor(target, pageX, pageY),
            created: now,
            updated: now
        });
        enterEdit(view);
        if (view.data.text) saveNote(view);
    }

    function focusNoteFromHash() {
        if (!location.hash.startsWith(HASH_PREFIX)) return;
        const id = decodeURIComponent(location.hash.slice(HASH_PREFIX.length));
        history.replaceState(null, '', location.pathname + location.search);
        const view = views.get(id);
        if (!view) return;
        if (view.data.collapsed) setCollapsed(view, false);
        layoutNote(view);
        if (view.el.hidden) return;
        view.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        view.el.classList.remove('flash');
        void view.el.offsetWidth; // restart the animation
        view.el.classList.add('flash');
    }

    // ─── Sync ──────────────────────────────────────────────────────────────────

    function onStorageChanged(changes, area) {
        if (area !== 'sync') return;
        let touched = false;
        for (const [key, { newValue }] of Object.entries(changes)) {
            if (!key.startsWith(KEY_PREFIX)) continue;
            touched = true;
            const view = views.get(key.slice(KEY_PREFIX.length));
            if (!newValue) {
                // Deleted elsewhere; an open editor keeps its text and saves it back
                if (view && !view.editing) removeView(view);
                continue;
            }
            if (newValue.page !== currentPage) continue;
            if (!view) {
                addView(newValue);
            } else if (!view.editing && !view.dragging && newValue.updated > view.data.updated) {
                view.data = newValue;
                renderNote(view);
            }
        }
        if (!touched) return;
        scheduleLayout();
        if (panel && !panel.host.hidden) panel.refresh();
    }

    // ─── Notes Panel ───────────────────────────────────────────────────────────

    function injectPanelButton() {
        const iconset = document.querySelector('.iconset');
        if (!iconset || iconset.querySelector('.ncku-notes-button')) return;

        // Same markup as Moodle's own icon bar entries
        const item = document.createElement('div');
        item.className = 'btn btn-secondary ncku-notes-button';
        const link = document.createElement('a');
        link.setAttribute('role', 'button');
        link.href = '#';
        link.title = t('panelButton');
        link.innerHTML = '<div class="navicon" align="center"><i class="fa fa-3x fa-sticky-note-o"></i></div>';
        link.append(t('panelButton'));
        link.addEventListener('click', e => {
            e.preventDefault();
            openPanel();
        });
        item.append(link);
        iconset.append(item);
    }

    function openPanel() {
        if (!panel) panel = buildPanel();
        panel.host.hidden = false;
        panel.refresh();
        panel.search.focus();
    }

    function buildPanel() {
        const esc = md.escapeHtml;
        const host = document.createElement('ncku-sticky-notes-panel');
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>${PANEL_CSS}</style>
            <div class="backdrop"></div>
            <section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(t('panelTitle'))}">
                <header>
                    <h2>${esc(t('panelTitle'))}</h2>
                    <button type="button" class="close" title="${esc(t('panelClose'))}">${ICON_CLOSE}</button>
                </header>
                <input type="search" class="search" placeholder="${esc(t('panelSearch'))}">
                <div class="list"></div>
                <footer class="usage"></footer>
            </section>`;
        isolateKeyboard(host);
        document.documentElement.appendChild(host);

        const close = () => { host.hidden = true; };
        const search = root.querySelector('.search');
        const list = root.querySelector('.list');
        const usage = root.querySelector('.usage');

        root.querySelector('.backdrop').addEventListener('click', close);
        root.querySelector('.close').addEventListener('click', close);
        host.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        search.addEventListener('input', () => refresh());

        list.addEventListener('click', e => {
            const del = e.target.closest('.delete');
            if (del) {
                e.preventDefault();
                if (del.classList.contains('confirm')) {
                    storage.remove(KEY_PREFIX + del.dataset.id);
                } else {
                    del.classList.add('confirm');
                    del.textContent = t('noteDeleteConfirm');
                    setTimeout(() => {
                        del.classList.remove('confirm');
                        del.innerHTML = ICON_TRASH;
                    }, DELETE_CONFIRM_MS);
                }
                return;
            }
            if (e.target.closest('.open')) close();
        });

        const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

        async function refresh() {
            const query = search.value.trim().toLowerCase();
            const notes = (await loadAllNotes())
                .filter(n => !query || [n.text, n.pageTitle, n.courseName].some(s => (s || '').toLowerCase().includes(query)))
                .sort((a, b) => b.updated - a.updated);

            // Group by course, most recently edited course first
            const groups = new Map();
            notes.forEach(n => {
                const key = n.courseId > 1 ? `course-${n.courseId}` : 'other';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(n);
            });

            if (!notes.length) {
                list.innerHTML = `<p class="empty">${esc(query ? t('panelNoMatch') : t('panelEmpty'))}</p>`;
            } else {
                list.innerHTML = [...groups.entries()].map(([key, items]) => {
                    const title = key === 'other'
                        ? t('panelOtherPages')
                        : (items.find(n => n.courseName) || items[0]).courseName || items[0].pageTitle;
                    return `<h3>${esc(title)}</h3>` + items.map(n => `
                        <div class="item" data-color="${esc(n.color)}">
                            <a class="open" href="${esc(n.url + HASH_PREFIX + encodeURIComponent(n.id))}">
                                <span class="text">${esc(md.toPlainText(n.text))}</span>
                                <span class="meta">${esc(n.pageTitle || n.url)} · ${esc(dateFormat.format(n.updated))}</span>
                            </a>
                            <button type="button" class="delete" data-id="${esc(n.id)}" title="${esc(t('noteDelete'))}">${ICON_TRASH}</button>
                        </div>`).join('');
                }).join('');
            }

            try {
                if (!storage.QUOTA_BYTES) throw new Error('quota unknown');
                const used = await storage.getBytesInUse(null);
                usage.textContent = t('panelUsage', (used / 1024).toFixed(1), String(Math.round(storage.QUOTA_BYTES / 1024)));
            } catch {
                usage.textContent = '';
            }
        }

        return { host, search, refresh };
    }

    // ─── Styles & Icons ────────────────────────────────────────────────────────

    const ICON_MINUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const ICON_TRASH = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    const ICON_NOTE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h10v7l-3.5 4H3z M13 9.5H9.5v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 6h5M5.5 8.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';

    const COLOR_CSS = `
        [data-color="yellow"] { --bg: #fff7c2; --bar: #fbe98a; --edge: #e9d35c; }
        [data-color="pink"]   { --bg: #ffe1ea; --bar: #fbc2d3; --edge: #ec9fb6; }
        [data-color="green"]  { --bg: #ddf6dd; --bar: #b5e6b5; --edge: #8fd08f; }
        [data-color="blue"]   { --bg: #ddeeff; --bar: #b6d8f8; --edge: #8dbdeb; }
        [data-color="purple"] { --bg: #ece2ff; --bar: #d3c0fa; --edge: #b49be9; }`;

    const NOTE_CSS = `
        :host { all: initial; }
        ${COLOR_CSS}
        [hidden] { display: none !important; }
        .note {
            position: absolute;
            box-sizing: border-box;
            min-width: ${MIN_WIDTH}px;
            max-width: 600px;
            background: var(--bg);
            border: 1px solid var(--edge);
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
            color: #2b2b2b;
            font: 14px/1.55 ${FONT};
            resize: horizontal;
            overflow: hidden;
        }
        .note.dragging { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24); opacity: 0.95; }
        .note.flash { animation: flash 1.6s ease-out; }
        @keyframes flash {
            0%, 40% { box-shadow: 0 0 0 4px rgba(255, 170, 0, 0.75), 0 2px 10px rgba(0, 0, 0, 0.16); }
            100% { box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16); }
        }
        .bar {
            display: flex;
            align-items: center;
            gap: 2px;
            height: 24px;
            padding: 0 4px;
            background: var(--bar);
            cursor: grab;
            touch-action: none;
            user-select: none;
        }
        .note.dragging .bar { cursor: grabbing; }
        .grip { flex: 1; align-self: stretch; }
        button { font: inherit; color: inherit; }
        .tool {
            display: grid;
            place-items: center;
            width: 20px;
            height: 20px;
            padding: 0;
            border: 0;
            border-radius: 4px;
            background: transparent;
            color: #5a5a5a;
            cursor: pointer;
        }
        .tool:hover { background: rgba(0, 0, 0, 0.08); color: #222; }
        .tool:focus-visible, .swatch:focus-visible, .chip:focus-visible { outline: 2px solid #3b82f6; outline-offset: 1px; }
        .tool svg { width: 14px; height: 14px; }
        .tool.color::before {
            content: "";
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--bg);
            border: 1.5px solid var(--edge);
            box-sizing: border-box;
        }
        .tool.delete.confirm { background: #e5484d; color: #fff; }
        .palette { display: flex; gap: 6px; padding: 6px 8px; background: var(--bar); border-top: 1px solid var(--edge); }
        .swatch {
            width: 18px;
            height: 18px;
            padding: 0;
            border-radius: 50%;
            border: 1.5px solid var(--edge);
            background: var(--bg);
            cursor: pointer;
        }
        .content {
            padding: 8px 10px;
            max-height: 50vh;
            overflow: auto;
            cursor: text;
            overflow-wrap: anywhere;
        }
        .editor {
            display: block;
            box-sizing: border-box;
            width: 100%;
            min-height: 72px;
            max-height: 50vh;
            margin: 0;
            padding: 8px 10px;
            border: 0;
            outline: none;
            resize: none;
            background: transparent;
            color: inherit;
            font: 13px/1.55 ui-monospace, SFMono-Regular, Consolas, "Microsoft JhengHei", monospace;
        }
        .editor::placeholder { color: rgba(0, 0, 0, 0.4); }
        .status { padding: 4px 10px 6px; color: #b42318; font-size: 12px; }
        .chip {
            display: none;
            place-items: center;
            width: 28px;
            height: 28px;
            padding: 0;
            border: 0;
            background: var(--bg);
            color: #5a4a00;
            cursor: pointer;
            touch-action: none;
        }
        .chip svg { width: 16px; height: 16px; }
        .note.collapsed { min-width: 0; width: auto; resize: none; border-radius: 6px; }
        .note.collapsed > :not(.chip) { display: none !important; }
        .note.collapsed .chip { display: grid; }

        .md > :first-child { margin-top: 0; }
        .md > :last-child { margin-bottom: 0; }
        .md p, .md ul, .md ol, .md pre, .md blockquote { margin: 0 0 6px; }
        .md h1, .md h2, .md h3 { margin: 4px 0 6px; line-height: 1.3; }
        .md h1 { font-size: 17px; }
        .md h2 { font-size: 15.5px; }
        .md h3 { font-size: 14.5px; }
        .md ul, .md ol { padding-left: 20px; }
        .md ul ul, .md ol ol, .md ul ol, .md ol ul { margin: 2px 0 0; }
        .md li.task { list-style: none; margin-left: -18px; }
        .md li.task input { margin: 0 4px 0 0; vertical-align: -2px; cursor: pointer; }
        .md li.task.done { color: rgba(0, 0, 0, 0.5); text-decoration: line-through; }
        .md code { padding: 1px 4px; border-radius: 3px; background: rgba(0, 0, 0, 0.07); font: 12.5px ui-monospace, SFMono-Regular, Consolas, monospace; }
        .md pre { padding: 6px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.07); overflow: auto; }
        .md pre code { padding: 0; background: none; }
        .md blockquote { padding-left: 8px; border-left: 3px solid var(--edge); color: rgba(0, 0, 0, 0.65); }
        .md hr { border: 0; border-top: 1px solid var(--edge); margin: 8px 0; }
        .md a { color: #0b5cad; }`;

    const PANEL_CSS = `
        :host { all: initial; }
        :host([hidden]) { display: none; }
        ${COLOR_CSS}
        .backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); }
        .dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            width: min(640px, calc(100vw - 32px));
            max-height: min(80vh, 720px);
            padding: 20px;
            border-radius: 10px;
            background: #fff;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            color: #1f2937;
            font: 14px/1.5 ${FONT};
        }
        header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        h2 { margin: 0; font-size: 18px; }
        button { font: inherit; }
        .close {
            display: grid;
            place-items: center;
            width: 32px;
            height: 32px;
            padding: 0;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #6b7280;
            cursor: pointer;
        }
        .close:hover { background: #f3f4f6; color: #111827; }
        .close svg { width: 18px; height: 18px; }
        .search {
            box-sizing: border-box;
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font: inherit;
        }
        .search:focus { outline: 2px solid #3b82f6; outline-offset: -1px; border-color: transparent; }
        .list { flex: 1; overflow: auto; margin-top: 12px; }
        h3 { margin: 16px 0 6px; font-size: 13px; color: #6b7280; font-weight: 600; }
        h3:first-child { margin-top: 0; }
        .item {
            position: relative;
            margin-bottom: 6px;
            border-left: 4px solid var(--edge);
            border-radius: 6px;
            background: var(--bg);
        }
        .item:hover { filter: brightness(0.97); }
        .open { display: block; padding: 8px 40px 8px 12px; border-radius: 6px; color: inherit; text-decoration: none; }
        .open:focus-visible { outline: 2px solid #3b82f6; }
        .text {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            overflow-wrap: anywhere;
        }
        .meta { display: block; margin-top: 2px; font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .delete {
            position: absolute;
            top: 6px;
            right: 6px;
            display: grid;
            place-items: center;
            min-width: 28px;
            height: 28px;
            padding: 0 6px;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #6b7280;
            cursor: pointer;
            font-size: 12px;
        }
        .delete:hover { background: rgba(0, 0, 0, 0.08); color: #b42318; }
        .delete.confirm { background: #e5484d; color: #fff; }
        .delete svg { width: 16px; height: 16px; }
        .empty { margin: 24px 0; text-align: center; color: #6b7280; }
        .usage { margin-top: 12px; font-size: 12px; color: #9ca3af; text-align: right; }
        .usage:empty { display: none; }`;

    // ─── Initialization ────────────────────────────────────────────────────────

    async function init() {
        document.addEventListener('contextmenu', rememberContext, true);
        chrome.runtime.onMessage.addListener(message => {
            if (message && message.type === 'add-sticky-note') createNote(message.selectionText || '');
        });
        chrome.storage.onChanged.addListener(onStorageChanged);
        window.addEventListener('hashchange', focusNoteFromHash);
        window.addEventListener('pagehide', flushSaves);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushSaves();
        });

        injectPanelButton();
        watchLayout();

        try {
            (await loadAllNotes())
                .filter(data => data.page === currentPage)
                .forEach(addView);
        } catch (err) {
            console.error(`${LOG_PREFIX} Failed to load notes:`, err);
        }
        scheduleLayout();
        requestAnimationFrame(focusNoteFromHash);
        if (DEBUG) console.log(`${LOG_PREFIX} Sticky notes ready (${views.size} on this page).`);
    }

    init();
})();
