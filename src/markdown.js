/**
 * Minimal Markdown renderer for sticky notes.
 * Supports headings, lists (nested), task lists, blockquotes, code blocks,
 * horizontal rules, bold / italic / strikethrough, inline code and links.
 * All input is HTML-escaped first, so the output only ever contains tags
 * produced here.
 */

const NckuMarkdown = (() => {
    'use strict';

    const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    const TASK = /^\[([ xX])\]\s+(.*)$/;
    const SAFE_URL = /^(https?:\/\/|mailto:)/i;

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function link(href, label) {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }

    // ─── Inline ────────────────────────────────────────────────────────────────

    function renderInline(raw) {
        // Code spans and links are swapped out for placeholders so emphasis
        // rules never reach inside them
        const tokens = [];
        const stash = html => `\u0000${tokens.push(html) - 1}\u0000`;

        let text = escapeHtml(raw.replace(/\u0000/g, ''))
            .replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`))
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) =>
                SAFE_URL.test(href) ? stash(link(href, label)) : match)
            .replace(/https?:\/\/[^\s<\u0000]*[^\s<\u0000.,;:!?)'"\]）。，、；：！？」』]/g, url => stash(link(url, url)));

        text = text
            .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^\p{L}\p{N}])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}])/gu, '$1<strong>$2</strong>')
            .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>')
            // Underscores inside words (e.g. 學號_姓名_HW1.pdf) are left alone
            .replace(/(^|[^\p{L}\p{N}])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}])/gu, '$1<em>$2</em>')
            .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<del>$1</del>');

        return text.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[i]);
    }

    // ─── Blocks ────────────────────────────────────────────────────────────────

    function indentWidth(spaces) {
        return spaces.replace(/\t/g, '    ').length;
    }

    function render(source) {
        const lines = source.replace(/\r\n?/g, '\n').split('\n');
        const out = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (/^\s*$/.test(line)) { i++; continue; }

            // Fenced code block
            if (/^\s*```/.test(line)) {
                const body = [];
                i++;
                while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
                i++; // closing fence (or end of input)
                out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
                continue;
            }

            const heading = line.match(/^(#{1,3})\s+(.*)$/);
            if (heading) {
                const level = heading[1].length;
                out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
                i++;
                continue;
            }

            if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
                out.push('<hr>');
                i++;
                continue;
            }

            if (/^\s*>/.test(line)) {
                const quoted = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) {
                    quoted.push(lines[i].replace(/^\s*>\s?/, ''));
                    i++;
                }
                out.push(`<blockquote>${render(quoted.join('\n'))}</blockquote>`);
                continue;
            }

            if (LIST_ITEM.test(line)) {
                i = renderList(lines, i, out);
                continue;
            }

            // Paragraph: keep the author's line breaks
            const para = [];
            while (i < lines.length && !/^\s*$/.test(lines[i]) && !startsBlock(lines[i])) {
                para.push(renderInline(lines[i].trim()));
                i++;
            }
            out.push(`<p>${para.join('<br>')}</p>`);
        }

        return out.join('');
    }

    function startsBlock(line) {
        return /^\s*```/.test(line) || /^#{1,3}\s/.test(line) || /^\s*>/.test(line) || LIST_ITEM.test(line);
    }

    /**
     * Renders consecutive list lines starting at `start`, nesting by indentation.
     * Task items carry their source line number so a checkbox click can be
     * written back with toggleTask().
     */
    function renderList(lines, start, out) {
        const stack = []; // { indent, tag }
        let i = start;

        const open = (indent, ordered) => {
            const tag = ordered ? 'ol' : 'ul';
            stack.push({ indent, tag });
            out.push(`<${tag}>`);
        };
        const close = () => out.push(`</li></${stack.pop().tag}>`);

        while (i < lines.length) {
            const m = lines[i].match(LIST_ITEM);
            if (!m) break;

            const indent = indentWidth(m[1]);
            const ordered = /\d/.test(m[2]);

            if (stack.length === 0 || indent > stack[stack.length - 1].indent) {
                open(indent, ordered);
            } else {
                while (stack.length > 1 && indent < stack[stack.length - 1].indent) close();
                out.push('</li>');
            }

            const task = m[3].match(TASK);
            if (task) {
                const checked = task[1] !== ' ';
                out.push(`<li class="task${checked ? ' done' : ''}"><input type="checkbox" data-line="${i}"${checked ? ' checked' : ''}> ${renderInline(task[2])}`);
            } else {
                out.push(`<li>${renderInline(m[3])}`);
            }
            i++;
        }

        while (stack.length) close();
        return i;
    }

    /** Flips the task checkbox on the given source line. */
    function toggleTask(source, lineIndex) {
        const lines = source.split('\n');
        const line = lines[lineIndex];
        if (line === undefined) return source;
        lines[lineIndex] = line.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/, (_, prefix, mark) =>
            `${prefix}[${mark === ' ' ? 'x' : ' '}]`);
        return lines.join('\n');
    }

    /** Plain-text preview used by the notes panel. */
    function toPlainText(source) {
        return source
            .replace(/```[\s\S]*?(```|$)/g, ' ')
            .replace(/^\s*(#{1,3}|>|[-*+]|\d+[.)])\s+/gm, '')
            .replace(/\[[ xX]\]\s+/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/(\*\*|__|~~|`)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    return { render, toggleTask, toPlainText, escapeHtml };
})();

if (typeof module !== 'undefined') module.exports = NckuMarkdown;
