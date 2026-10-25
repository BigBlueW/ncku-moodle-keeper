// Run with: node --test dev/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const md = require('../src/markdown.js');

test('escapes HTML', () => {
    assert.equal(md.render('<img src=x onerror=alert(1)>'), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    assert.equal(md.render('`<b>`'), '<p><code>&lt;b&gt;</code></p>');
});

test('keeps underscores inside file names', () => {
    assert.equal(md.render('檔名：學號_姓名_HW1.pdf'), '<p>檔名：學號_姓名_HW1.pdf</p>');
    assert.equal(md.render('snake_case_name'), '<p>snake_case_name</p>');
    assert.equal(md.render('an _italic_ word'), '<p>an <em>italic</em> word</p>');
});

test('inline formatting', () => {
    assert.equal(md.render('**粗體** *斜體* ~~刪除~~'), '<p><strong>粗體</strong> <em>斜體</em> <del>刪除</del></p>');
    assert.equal(md.render('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

test('links only allow safe protocols', () => {
    assert.equal(md.render('[作業](https://moodle.ncku.edu.tw/a?x=1&y=2)'),
        '<p><a href="https://moodle.ncku.edu.tw/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">作業</a></p>');
    assert.equal(md.render('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
    assert.equal(md.render('見 https://example.com。'),
        '<p>見 <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>。</p>');
});

test('paragraph line breaks are preserved', () => {
    assert.equal(md.render('第一行\n第二行\n\n新段落'), '<p>第一行<br>第二行</p><p>新段落</p>');
});

test('headings, quotes, rules and code blocks', () => {
    assert.equal(md.render('# 標題'), '<h1>標題</h1>');
    assert.equal(md.render('> 引用\n> 第二行'), '<blockquote><p>引用<br>第二行</p></blockquote>');
    assert.equal(md.render('---'), '<hr>');
    assert.equal(md.render('```\n<a> **x**\n```'), '<pre><code>&lt;a&gt; **x**</code></pre>');
});

test('nested lists', () => {
    assert.equal(md.render('- a\n  - b\n- c'), '<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
    assert.equal(md.render('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('task lists carry their source line', () => {
    const src = '待辦\n\n- [ ] 寫報告\n- [x] 交作業';
    assert.equal(md.render(src),
        '<p>待辦</p><ul><li class="task"><input type="checkbox" data-line="2"> 寫報告</li>' +
        '<li class="task done"><input type="checkbox" data-line="3" checked> 交作業</li></ul>');
    assert.equal(md.toggleTask(src, 2), '待辦\n\n- [x] 寫報告\n- [x] 交作業');
    assert.equal(md.toggleTask(src, 3), '待辦\n\n- [ ] 寫報告\n- [ ] 交作業');
    assert.equal(md.toggleTask(src, 0), src);
});

test('plain text preview', () => {
    assert.equal(md.toPlainText('# 繳交規則\n- [ ] 命名 **學號_姓名_HW1.pdf**\n[連結](https://a.b)'),
        '繳交規則 命名 學號_姓名_HW1.pdf 連結');
});
