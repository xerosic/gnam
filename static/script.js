const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const state = {
    items: [],
    filtered: [],
    activeId: null,
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
    <div class="k small">${escapeHtml(k)}</div>
    <div class="v mono">${escapeHtml(formatValue(v))}</div>
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

function hasData(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return !!v;
}

function section(title, content) {
    return `
  <div class="section">
    <header><h3>${title}</h3></header>
    <div class="content">${content}</div>
  </div>`;
}

function renderDetail(d) {
    const meta = section('Overview', `
    <div class="kv">
      <div class="k small">Request ID</div><div class="mono">${escapeHtml(d.request_id)}</div>
      <div class="k small">Time</div><div>${fmtTime(d.received_at)}</div>
      <div class="k small">Method</div><div class="mono">${escapeHtml(d.method)}</div>
      <div class="k small">URL</div><div class="mono">${escapeHtml(d.scheme)}://${escapeHtml(d.host)}${escapeHtml(d.path)}${d.query ? ('?' + escapeHtml(d.query)) : ''}</div>
      <div class="k small">IP</div><div class="mono">${escapeHtml(d.ip)}</div>
      <div class="k small">TLS</div><div>${d.tls_enabled ? ('Yes ' + (d.tls_version || '')) : 'No'}</div>
      <div class="k small">Content-Type</div><div class="mono">${escapeHtml(d.content_type || '')}</div>
      <div class="k small">Body</div><div>${formatBytes(d.body_size)}</div>
      <div class="k small">User-Agent</div><div class="mono">${escapeHtml(d.user_agent || '')}</div>
      <div class="k small">Referer</div><div class="mono">${escapeHtml(d.referer || '')}</div>
    </div>
  `);

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
        sections.push(section('Body (preview)', `<pre class="mono">${escapeHtml(d.body_preview || '')}</pre>`));
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

loadList();
