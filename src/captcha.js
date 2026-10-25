/**
 * Custom lightweight solver for NCKU Moodle numeric captchas.
 * Replaces Tesseract.js with template matching for better speed and lower memory.
 */

(function () {
    'use strict';

    const DEBUG = false;
    const LOG_PREFIX = '[NCKU Moodle Keeper]';

    const CONFIGS = [
        {
            name: "Moodle",
            imgSelector: "#imgcode",
            inputSelector: "#reg_vcode",
            templateFile: "templates.json"
        },
        {
            name: "NCKU Portal",
            imgSelector: "img[src*='c=verifycode']",
            inputSelector: "input[name='code']",
            templateFile: "templates2.json"
        },
        {
            // exptnsel.liberal.ncku.edu.tw
            name: "Liberal Education",
            imgSelector: "img[src*='index.php/verifycode']",
            inputSelector: "input[name='code']",
            templateFile: "templates2.json"
        },
        {
            // course-query.acad.ncku.edu.tw/sum (summer course signup)
            name: "Summer Course",
            imgSelector: "img[src*='comm/captcha.php']",
            inputSelector: "input[name='authcode']",
            templateFile: "templates.json"
        },
        {
            // score.ncku.edu.tw: the code is printed as plain text next to the input
            name: "Score",
            textSelector: "input[name='check_code'] + span",
            inputSelector: "input[name='code']"
        }
    ];

    const MAX_RETRIES = 20;
    const RETRY_DELAY_MS = 100;
    // Best-match score relative to the template's perfect score; below this the
    // digit is treated as unrecognized and a fresh captcha is requested
    const MIN_CONFIDENCE = 0.6;
    // Components at least this wide are assumed to be touching digits
    const MIN_SPLIT_WIDTH = 12;

    let currentConfig = null;
    let templates = null;
    let isProcessing = false;
    let retryCount = 0;
    let observer = null;

    // ─── Settings Management ───────────────────────────────────────────────────

    function loadTemplates() {
        if (templates) return Promise.resolve(templates);
        if (!currentConfig) return Promise.resolve(null);
        return fetch(chrome.runtime.getURL(currentConfig.templateFile))
            .then(res => res.json())
            .then(data => {
                templates = data;
                if (DEBUG) console.log(`${LOG_PREFIX} Templates loaded.`);
                return templates;
            })
            .catch(err => {
                console.error(`${LOG_PREFIX} Failed to load templates:`, err);
                return null;
            });
    }

    // ─── Core Solver Logic ──────────────────────────────────────────────────────

    function getBinarizedBits(img) {
        // Use the intrinsic size: pages may scale the <img> with CSS
        const w = img.naturalWidth, h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        const bits = [];
        for (let i = 0; i < data.length; i += 4) {
            // Threshold based on text being dark vs light background
            const r = data[i], g = data[i + 1], b = data[i + 2];
            bits.push((r < 160 || g < 160 || b < 160) ? 1 : 0);
        }
        return bits;
    }

    function segmentDigits(bits, w, h) {
        // De-noise cleanup
        const clean = new Array(bits.length).fill(0);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                if (bits[y * w + x]) {
                    let neighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (bits[(y + dy) * w + (x + dx)]) neighbors++;
                        }
                    }
                    if (neighbors >= 1) clean[y * w + x] = 1;
                }
            }
        }

        const visited = new Set();
        const components = [];
        for (let i = 0; i < clean.length; i++) {
            if (clean[i] && !visited.has(i)) {
                const comp = []; const q = [i]; visited.add(i);
                while (q.length > 0) {
                    const curr = q.shift(); comp.push(curr);
                    const cx = curr % w, cy = Math.floor(curr / w);
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ni = (cy + dy) * w + (cx + dx);
                            if (cx+dx >= 0 && cx+dx < w && cy+dy >= 0 && cy+dy < h && clean[ni] && !visited.has(ni)) {
                                visited.add(ni); q.push(ni);
                            }
                        }
                    }
                }
                if (comp.length > 10) components.push(comp);
            }
        }

        const bounds = comp => {
            let minX = w, maxX = 0, minY = h, maxY = 0;
            comp.forEach(idx => {
                const x = idx % w, y = Math.floor(idx / w);
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            });
            return { comp, minX, maxX, minY, maxY };
        };
        const boxes = components.map(bounds);

        // Touching digits form one wide component; cut the widest one at its
        // thinnest column near the middle until there are 4 pieces
        while (boxes.length > 0 && boxes.length < 4) {
            let widest = 0;
            boxes.forEach((b, i) => { if (b.maxX - b.minX > boxes[widest].maxX - boxes[widest].minX) widest = i; });
            const b = boxes[widest];
            const bw = b.maxX - b.minX + 1;
            if (bw < MIN_SPLIT_WIDTH) break;

            const colCount = new Array(bw).fill(0);
            b.comp.forEach(idx => colCount[(idx % w) - b.minX]++);
            let cut = -1;
            for (let x = Math.floor(bw * 0.3); x <= Math.ceil(bw * 0.7); x++) {
                if (cut < 0 || colCount[x] < colCount[cut] ||
                    (colCount[x] === colCount[cut] && Math.abs(x - bw / 2) < Math.abs(cut - bw / 2))) cut = x;
            }
            const left = b.comp.filter(idx => (idx % w) - b.minX < cut);
            const right = b.comp.filter(idx => (idx % w) - b.minX >= cut);
            boxes.splice(widest, 1, bounds(left), bounds(right));
        }

        return boxes.map(({ comp, minX, maxX, minY, maxY }) => {
            const dw = maxX - minX + 1, dh = maxY - minY + 1;
            const matrix = Array.from({ length: dh }, () => new Array(dw).fill(0));
            comp.forEach(idx => { matrix[Math.floor(idx / w) - minY][(idx % w) - minX] = 1; });
            return { x: minX, matrix };
        }).sort((a, b) => a.x - b.x).map(d => d.matrix).slice(0, 4);
    }

    function perfectScore(template) {
        return 2 * template.flat().reduce((sum, v) => sum + v, 0);
    }

    function compare(m1, m2) {
        const h1 = m1.length, w1 = m1[0].length;
        const h2 = m2.length, w2 = m2[0].length;
        const pad = 2;
        let bestScore = -Infinity;

        for (let dy = -pad; dy <= pad; dy++) {
            for (let dx = -pad; dx <= pad; dx++) {
                let score = 0;
                for (let y = 0; y < Math.max(h1, h2 + dy); y++) {
                    for (let x = 0; x < Math.max(w1, w2 + dx); x++) {
                        const v1 = (y < h1 && x < w1) ? m1[y][x] : 0;
                        const v2 = (y - dy >= 0 && y - dy < h2 && x - dx >= 0 && x - dx < w2) ? m2[y - dy][x - dx] : 0;
                        if (v1 === 1 && v2 === 1) score += 2;
                        else if (v1 !== v2) score -= 1;
                    }
                }
                bestScore = Math.max(bestScore, score);
            }
        }
        return bestScore;
    }

    // ─── Main Logic ─────────────────────────────────────────────────────────────

    function fillInput(inputEl, code) {
        // Set value natively to trigger events
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputEl, code);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function solveTextCaptcha() {
        const textEl = document.querySelector(currentConfig.textSelector);
        const inputEl = document.querySelector(currentConfig.inputSelector);
        if (!textEl || !inputEl || inputEl.dataset.ocrAttached) return;
        const code = textEl.textContent.replace(/\D/g, '');
        if (!code) return;
        inputEl.dataset.ocrAttached = "true";
        fillInput(inputEl, code);
        if (DEBUG) console.log(`${LOG_PREFIX} Copied text code: ${code}`);
    }

    async function solveCaptcha() {
        if (isProcessing) return;
        if (!templates) return;
        if (!currentConfig) return;

        const imgEl = document.querySelector(currentConfig.imgSelector);
        const inputEl = document.querySelector(currentConfig.inputSelector);
        if (!imgEl || !inputEl) return;

        if (!imgEl.complete || imgEl.naturalWidth === 0) {
            imgEl.addEventListener('load', solveCaptcha, { once: true });
            return;
        }

        isProcessing = true;
        if (DEBUG) console.log(`${LOG_PREFIX} Attempting recognize (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})…`);

        try {
            const bits = getBinarizedBits(imgEl);
            const digitMatrices = segmentDigits(bits, imgEl.naturalWidth, imgEl.naturalHeight);

            if (digitMatrices.length !== 4) {
                throw new Error("Could not find exactly 4 digits");
            }

            let code = "";
            digitMatrices.forEach(m => {
                let bestDigit = "?", maxScore = -Infinity;
                for (let d = 0; d <= 9; d++) {
                    const score = compare(m, templates[d]);
                    if (score > maxScore) { maxScore = score; bestDigit = String(d); }
                }
                if (bestDigit !== "?" && maxScore < MIN_CONFIDENCE * perfectScore(templates[bestDigit])) bestDigit = "?";
                code += bestDigit;
            });

            if (code.includes("?")) throw new Error("Recognition incomplete");

            if (DEBUG) console.log(`${LOG_PREFIX} Recognized: ${code}`);

            fillInput(inputEl, code);

            retryCount = 0;
        } catch (err) {
            if (DEBUG) console.warn(`${LOG_PREFIX} Recognition failed: ${err.message}`);
            handleRetry(imgEl);
        } finally {
            isProcessing = false;
        }
    }

    function handleRetry(imgEl) {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(() => { isProcessing = false; imgEl.click(); }, RETRY_DELAY_MS);
        } else {
            console.error(`${LOG_PREFIX} Max retries reached.`);
            retryCount = 0;
        }
    }

    // ─── Initialization ──────────────────────────────────────────────────────────

    async function setup() {
        // Find which config matches the current page
        if (!currentConfig) {
            for (const config of CONFIGS) {
                const sourceEl = document.querySelector(config.textSelector || config.imgSelector);
                const inputEl = document.querySelector(config.inputSelector);
                if (sourceEl && inputEl) {
                    currentConfig = config;
                    break;
                }
            }
        }

        if (!currentConfig) return;

        if (currentConfig.textSelector) {
            solveTextCaptcha();
            return;
        }

        const imgEl = document.querySelector(currentConfig.imgSelector);
        const inputEl = document.querySelector(currentConfig.inputSelector);

        if (imgEl.dataset.ocrAttached) return;
        imgEl.dataset.ocrAttached = "true";

        await loadTemplates();
        solveCaptcha();

        imgEl.addEventListener('load', () => {
            isProcessing = false;
            solveCaptcha();
        });
    }

    function startObserving() {
        if (observer) return;
        observer = new MutationObserver(() => {
            if (!currentConfig) {
                setup();
            } else {
                if (document.querySelector(currentConfig.textSelector || currentConfig.imgSelector)) setup();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    startObserving();
    setup();

})();
