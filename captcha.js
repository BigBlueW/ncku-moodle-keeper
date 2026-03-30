/**
 * Uses Tesseract.js (local OCR) to solve numeric verification codes.
 */

(function () {
    'use strict';

    const DEBUG = false;

    const LOG_PREFIX = '[NCKU Moodle Keeper]';
    const CAPTCHA_IMG_ID = 'imgcode';
    const CAPTCHA_INPUT_ID = 'reg_vcode';
    const STORAGE_KEY = 'captchaAutoFill';

    const MAX_RETRIES = 100;
    const RETRY_DELAY_MS = 50;

    let worker = null;
    let isProcessing = false;
    let retryCount = 0;
    let observer = null;
    let autoFillEnabled = true;

    // ─── Settings Management ───────────────────────────────────────────────────

    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                // Default to true if not set
                autoFillEnabled = result[STORAGE_KEY] !== false;
                resolve(autoFillEnabled);
            });
        });
    }

    function saveSettings(enabled) {
        autoFillEnabled = enabled;
        chrome.storage.local.set({ [STORAGE_KEY]: enabled });
    }

    // ─── UI Injection ──────────────────────────────────────────────────────────

    function injectToggle(imgEl) {
        if (document.getElementById('ncku-captcha-toggle-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'ncku-captcha-toggle-wrapper';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginLeft = '10px';
        wrapper.style.verticalAlign = 'middle';
        wrapper.style.fontFamily = 'sans-serif';
        wrapper.style.fontSize = '12px';
        wrapper.style.color = '#555';

        const label = document.createElement('label');
        label.innerText = 'AutoCaptcha';
        label.style.marginRight = '5px';
        label.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = autoFillEnabled;
        checkbox.style.cursor = 'pointer';
        checkbox.style.width = '14px';
        checkbox.style.height = '14px';

        checkbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            saveSettings(enabled);
            if (DEBUG) console.log(`${LOG_PREFIX} Auto-fill ${enabled ? 'enabled' : 'disabled'}.`);
            if (enabled) {
                retryCount = 0;
                solveCaptcha();
            }
        });

        wrapper.appendChild(label);
        wrapper.appendChild(checkbox);

        // Insert after image
        imgEl.parentNode.insertBefore(wrapper, imgEl.nextSibling);
    }

    // ─── Tesseract Worker Initialisation ────────────────────────────────────────

    async function initWorker() {
        if (worker) return worker;

        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
            console.error(`${LOG_PREFIX} Extension context invalidated. Please refresh the page.`);
            return null;
        }

        const extBase = chrome.runtime.getURL('vendor/');

        try {
            worker = await Tesseract.createWorker('eng', 1, {
                workerPath: extBase + 'worker.min.js',
                corePath: extBase + 'tesseract-core-lstm.wasm.js',
                langPath: extBase,
                cacheMethod: 'none',
                logger: () => { },
            });

            await worker.setParameters({
                tessedit_char_whitelist: '0123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
            });

            if (DEBUG) console.log(`${LOG_PREFIX} Tesseract worker ready.`);
            return worker;
        } catch (err) {
            console.error(`${LOG_PREFIX} Failed to init Tesseract worker:`, err);
            return null;
        }
    }

    // ─── Image Preprocessing ────────────────────────────────────────────────────

    function preprocessCaptchaImage(img) {
        const SCALE = 3;
        const srcW = img.naturalWidth || img.width || 100;
        const srcH = img.naturalHeight || img.height || 40;

        const canvas = document.createElement('canvas');
        canvas.width = srcW * SCALE;
        canvas.height = srcH * SCALE;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            let enhanced = (lum - 40) * (255 / 180);
            enhanced = Math.max(0, Math.min(255, enhanced));

            const val = enhanced < 128 ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
            data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    }

    // ─── Core OCR + Fill ────────────────────────────────────────────────────────

    async function solveCaptcha() {
        if (isProcessing) return;
        if (!autoFillEnabled) return;

        const imgEl = document.getElementById(CAPTCHA_IMG_ID);
        const inputEl = document.getElementById(CAPTCHA_INPUT_ID);

        if (!imgEl || !inputEl) return;

        if (!imgEl.complete || imgEl.naturalWidth === 0) {
            imgEl.addEventListener('load', solveCaptcha, { once: true });
            return;
        }

        isProcessing = true;
        if (DEBUG) console.log(`${LOG_PREFIX} Attempting OCR (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})…`);

        try {
            const dataUrl = preprocessCaptchaImage(imgEl);
            const w = await initWorker();
            if (!w) throw new Error("Worker not initialized");

            const { data: { text } } = await w.recognize(dataUrl);
            const code = text.replace(/\D/g, '').slice(0, 4);

            if (code.length !== 4) {
                if (DEBUG) console.warn(`${LOG_PREFIX} OCR result "${code}" is not 4 digits, retrying…`);
                handleRetry(imgEl);
            } else {
                if (DEBUG) console.log(`${LOG_PREFIX} Captcha recognised: ${code}`);
                retryCount = 0;
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(inputEl, code);
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} OCR error:`, err);
            handleRetry(imgEl);
        } finally {
            isProcessing = false;
        }
    }

    function handleRetry(imgEl) {
        if (!autoFillEnabled) return;
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(() => {
                isProcessing = false;
                imgEl.click();
            }, RETRY_DELAY_MS);
        } else {
            console.error(`${LOG_PREFIX} Max retries reached.`);
            retryCount = 0;
        }
    }

    // ─── Detection Logic ────────────────────────────────────────────────────────

    async function setup() {
        const imgEl = document.getElementById(CAPTCHA_IMG_ID);
        const inputEl = document.getElementById(CAPTCHA_INPUT_ID);

        if (!imgEl || !inputEl) return;

        await loadSettings();
        injectToggle(imgEl);

        if (imgEl.dataset.ocrAttached) return;
        imgEl.dataset.ocrAttached = "true";

        if (DEBUG) console.log(`${LOG_PREFIX} Captcha initialized.`);
        solveCaptcha();

        imgEl.addEventListener('load', () => {
            isProcessing = false;
            solveCaptcha();
        });
    }

    function startObserving() {
        if (observer) return;
        observer = new MutationObserver(() => {
            const imgEl = document.getElementById(CAPTCHA_IMG_ID);
            if (imgEl) setup();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ─── Boot ───────────────────────────────────────────────────────────────────

    startObserving();
    setup();

})();
