const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const state = {
    items: [],
    filtered: [],
    activeId: null,
    activeDetail: null,
};

function formatBytes(n) {
    if (n == null) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ } return `${n.toFixed((i ? 1 : 0))} ${u[i]}`
}

function fmtTime(s) {
    try { return new Date(s).toLocaleString(); } catch { return s }
}

function renderList() {
    const list = $('#list');
    list.innerHTML = '';
    for (const it of state.filtered) {
        const li = document.createElement('li');
        li.dataset.id = it.request_id;
        li.className = it.request_id === state.activeId ? 'active' : '';
        li.innerHTML = `
      <div class="top">
        <span class="badge method method-${(it.method || '').toUpperCase()}">${it.method}</span>
        <span class="path mono">${it.host}${it.path}${it.query ? ('?' + it.query) : ''}</span>
      </div>
      <div class="small">${fmtTime(it.received_at)} • ${it.ip} • ${formatBytes(it.body_size)} • ${it.content_type || ''}</div>
    `;
        li.addEventListener('click', () => select(it.request_id));
        list.appendChild(li);
    }
}

function applyFilter() {
    const q = $('#search').value.trim().toLowerCase();
    if (!q) { state.filtered = state.items; renderList(); return; }
    const tokens = q.split(/\s+/).filter(Boolean);
    state.filtered = state.items.filter(it => {
        const hay = [
            it.method, it.host, it.path, it.query, it.ip, it.content_type, it.user_agent, it.request_id
        ].map(v => (v || '').toString().toLowerCase()).join(' ');
        return tokens.every(t => hay.includes(t));
    });
    renderList();
}

async function loadList() {
    setStatus('Loading…');
    try {
        const res = await fetch('/api/requests?limit=200');
        if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) { throw new Error('Unexpected response'); }
        const data = await res.json();
        state.items = data.items || [];
        state.filtered = state.items;
        renderList();
        setStatus(`Loaded ${state.items.length} requests`);
    } catch (err) {
        console.error(err);
        setStatus(`Error loading: ${err.message || err}`);
    }
}

async function select(id) {
    if (!id) { return; }
    state.activeId = id; renderList();
    setStatus('Fetching…');
    try {
        const res = await fetch(`/api/requests/${encodeURIComponent(id)}`);
        if (!res.ok) { $('#detail').innerHTML = '<div class="empty">Not found</div>'; setStatus('Not found'); return }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) { throw new Error('Unexpected response'); }
        const d = await res.json();
        state.activeDetail = d;
        renderDetail(d);
        setStatus('Ready');
    } catch (err) {
        console.error(err);
        $('#detail').innerHTML = '<div class="empty">Failed to load details</div>';
        setStatus(`Error: ${err.message || err}`);
    }
}

function renderKV(obj) {
    if (!obj) return '<div class="small">—</div>';
    const entries = Object.entries(obj);
    if (!entries.length) return '<div class="small">—</div>';
    return '<div class="kv">' + entries.map(([k, v]) => `
        <div class="k">${escapeHtml(k)}</div>
        <div class="v mono">${escapeHtml(formatKVValue(v))}</div>
    `).join('') + '</div>';
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

function formatValue(v) {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
}

// For key-value tables (headers, cookies, forms), avoid JSON-y brackets for arrays
function formatKVValue(v) {
    if (v == null) return '';
    if (Array.isArray(v)) {
        // Join multiple values with comma+space for compact display
        return v.map(x => (x == null ? '' : String(x))).filter(Boolean).join(', ');
    }
    if (typeof v === 'object') {
        // Objects are rare here; fallback to stringified
        return JSON.stringify(v, null, 2);
    }
    return String(v);
}

function hasData(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return !!v;
}

function section(title, content, actions = '') {
    return `
    <div class="section" data-collapsed="false">
        <header>
            <h3>${title}</h3>
            <div class="head-actions">
                ${actions}
                <button class="sec-toggle" aria-expanded="true" title="Collapse section">▾</button>
            </div>
        </header>
        <div class="content">${content}</div>
    </div>`;
}

function renderDetail(d) {
    const meta = section('Overview', `
    <div class="kv">
    <div class="k">Request ID</div><div class="mono">${escapeHtml(d.request_id)}</div>
    <div class="k">Time</div><div>${fmtTime(d.received_at)}</div>
    <div class="k">Method</div><div class="mono">${escapeHtml(d.method)}</div>
    <div class="k">URL</div><div class="mono">${escapeHtml(d.scheme)}://${escapeHtml(d.host)}${escapeHtml(d.path)}${d.query ? ('?' + escapeHtml(d.query)) : ''}</div>
    <div class="k">IP</div><div class="mono">${escapeHtml(d.ip)}</div>
    <div class="k">TLS</div><div>${d.tls_enabled ? ('Yes ' + (d.tls_version || '')) : 'No'}</div>
    <div class="k">Content-Type</div><div class="mono">${escapeHtml(d.content_type || '')}</div>
    <div class="k">Body</div><div>${formatBytes(d.body_size)}</div>
    <div class="k">User-Agent</div><div class="mono">${escapeHtml(d.user_agent || '')}</div>
    <div class="k">Referer</div><div class="mono">${escapeHtml(d.referer || '')}</div>
        </div>
    `, `<button class="btn btn-subtle" data-action="copy-curl">Copy as cURL</button>`);

    const sections = [];
    // Always show headers
    sections.push(section('Headers', renderKV(d.header)));
    // Optional sections only if they have data
    if (hasData(d.cookies)) sections.push(section('Cookies', renderKV(d.cookies)));
    const formCombined = Object.assign({}, d.form || {}, d.post_form || {});
    if (hasData(formCombined)) sections.push(section('Form / PostForm', renderKV(formCombined)));
    if (hasData(d.multipart_form)) sections.push(section('Multipart', renderKV(d.multipart_form)));
    if (hasData(d.trailer)) sections.push(section('Trailer', renderKV(d.trailer)));
    // Body: only for methods that commonly include bodies and if size > 0
    const method = (d.method || '').toUpperCase();
    const allowBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (allowBody && d.body_size > 0 && d.body_preview) {
        const isLikelyJSON = (d.content_type || '').toLowerCase().includes('json') || /^[\[{]/.test(d.body_preview.trim());
        if (isLikelyJSON) {
            const highlighted = highlightJSONSafe(d.body_preview);
            sections.push(section('Body (JSON)', highlighted, `<button class=\"btn btn-subtle\" data-action=\"copy-json\">Copy JSON</button>`));
        } else {
            sections.push(section('Body (preview)', `<pre class="mono">${escapeHtml(d.body_preview || '')}</pre>`));
        }
    }

    $('#detail').innerHTML = meta + sections.join('');
}

function setStatus(s) { $('#status').textContent = s }

$('#refresh').addEventListener('click', loadList);
let searchTimer;
$('#search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 150);
});

// Section toggle and copy actions via delegation
$('#detail').addEventListener('click', (e) => {
    const tgl = e.target.closest('.sec-toggle');
    if (tgl) {
        const sec = tgl.closest('.section');
        const collapsed = sec.classList.toggle('collapsed');
        tgl.setAttribute('aria-expanded', String(!collapsed));
        tgl.textContent = collapsed ? '▸' : '▾';
        return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'copy-curl') {
        const d = state.activeDetail; if (!d) return;
        const cmd = buildCurl(d);
        copyToClipboard(cmd).then(() => setStatus('Copied cURL')).catch(() => setStatus('Copy failed'));
    } else if (action === 'copy-json') {
        const d = state.activeDetail; if (!d || !d.body_preview) return;
        let text = d.body_preview; try { text = JSON.stringify(JSON.parse(text), null, 2) } catch { }
        copyToClipboard(text).then(() => setStatus('Copied JSON')).catch(() => setStatus('Copy failed'));
    }
});

loadList();

// Try to pretty-print and highlight JSON; fallback to escaped text in a <pre>
function highlightJSONSafe(raw) {
    try {
        // If parse fails, we fall through to plain pre
        const parsed = JSON.parse(raw);
        const pretty = JSON.stringify(parsed, null, 2);
        return highlightJSON(pretty);
    } catch {
        return `<pre class="mono">${escapeHtml(raw)}</pre>`;
    }
}

function highlightJSON(prettyJson) {
    // Tokenize via regex, escape gaps and tokens separately
    const rx = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:)|("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = rx.exec(prettyJson)) !== null) {
        out += escapeHtml(prettyJson.slice(last, m.index));
        const match = m[0];
        const key = m[1];
        const str = m[2];
        const boolNull = m[3];
        let cls;
        if (key) cls = 'tok-key';
        else if (str) cls = 'tok-string';
        else if (boolNull) cls = /true|false/.test(boolNull) ? 'tok-boolean' : 'tok-null';
        else cls = 'tok-number';
        out += `<span class="${cls}">${escapeHtml(match)}</span>`;
        last = m.index + match.length;
    }
    out += escapeHtml(prettyJson.slice(last));
    return `<pre class="mono code-json">${out}</pre>`;
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            ok ? resolve() : reject(new Error('execCommand failed'));
        } catch (e) { reject(e) }
    });
}

function shellQuoteSingle(s) {
    if (s == null) return "''";
    return `'${String(s).replace(/'/g, `'"'"'`)}'`;
}

function allowBodyForMethod(m) {
    const method = (m || '').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function shouldSkipHeader(k) {
    const skip = new Set(['host', 'content-length']);
    return skip.has(String(k).toLowerCase());
}

function buildCurl(d) {
    const url = `${d.scheme}://${d.host}${d.path}${d.query ? ('?' + d.query) : ''}`;
    const parts = ['curl', '-X', d.method, shellQuoteSingle(url)];
    const hdr = d.header || {};
    for (const [k, v] of Object.entries(hdr)) {
        if (shouldSkipHeader(k)) continue;
        if (Array.isArray(v)) {
            for (const vv of v) parts.push('-H', shellQuoteSingle(`${k}: ${vv}`));
        } else {
            parts.push('-H', shellQuoteSingle(`${k}: ${v}`));
        }
    }
    if (allowBodyForMethod(d.method) && d.body_size > 0 && d.body_preview) {
        parts.push('--data-raw', shellQuoteSingle(d.body_preview));
    }
    return parts.join(' ');
}
