import { basename } from 'node:path'

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

export function renderHtmlReport(rows, report, source) {
  const errorRate = (report.errors / report.requests * 100).toFixed(1)
  const routes = Object.entries(report.routes).sort((a, b) => b[1] - a[1])
  const maxLatency = Math.max(...rows.map(row => row.durationMs), 1)
  const maxRoute = Math.max(...routes.map(([, count]) => count))
  const routeBars = routes.map(([path, count]) => `
    <div class="route">
      <div class="route-label"><code>${escape(path)}</code><strong>${count}</strong></div>
      <div class="track"><span style="width:${count / maxRoute * 100}%"></span></div>
    </div>`).join('')
  const latencyBars = rows.map((row, index) => `
    <div class="latency-column" title="Request ${index + 1}: ${escape(row.path)}, ${row.durationMs} ms">
      <span class="${row.status >= 500 ? 'error-bar' : ''}" style="height:${Math.max(3, row.durationMs / maxLatency * 100)}%"></span>
    </div>`).join('')
  const tableRows = rows.map((row, index) => `
    <tr data-index="${index}" data-status="${row.status}" data-latency="${row.durationMs}">
      <td class="muted">${String(index + 1).padStart(2, '0')}</td>
      <td><code>${escape(row.path)}</code></td>
      <td><span class="status ${row.status >= 500 ? 'error' : row.status >= 400 ? 'warning' : ''}">${row.status}</span></td>
      <td class="duration">${row.durationMs}<span class="muted"> ms</span></td>
      <td class="latency-cell"><div class="track"><span class="${row.status >= 500 ? 'error-bar' : ''}" style="width:${Math.max(2, row.durationMs / maxLatency * 100)}%"></span></div></td>
    </tr>`).join('')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Request Report · ${escape(basename(source))}</title>
  <style>
    :root{color-scheme:dark;--bg:#101413;--panel:#191e1b;--line:#313a33;--text:#f0f3ec;--muted:#a3afa4;--green:#cef27c;--red:#ff9380}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    button,input,select{font:inherit}button,select{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--green);outline-offset:3px}
    .wrap{max-width:1160px;margin:auto;padding:30px 32px 44px}
    header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:10px;font-weight:650;letter-spacing:-.4px}.brand-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--green);color:#172011;font-weight:800}
    .file{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);overflow-wrap:anywhere}
    .intro{display:flex;justify-content:space-between;align-items:end;gap:24px;margin:32px 0 24px}
    .eyebrow{color:var(--green);font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700}
    h1{font-size:38px;line-height:1.15;letter-spacing:-1.6px;margin:8px 0 12px;font-weight:550}p{margin:0;color:var(--muted)}
    .summary-pill{white-space:nowrap;border:1px solid var(--line);border-radius:100px;padding:9px 14px;font-size:12px;color:var(--muted)}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:${report.errors ? 'var(--red)' : 'var(--green)'};margin-right:7px}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
    .card{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:20px}
    .metric-label{font-size:12px;color:var(--muted)}.metric-value{display:flex;align-items:baseline;gap:6px;margin:8px 0 4px;font-size:34px;font-weight:500;letter-spacing:-1px;font-variant-numeric:tabular-nums}.metric-value small{font-size:15px;color:var(--muted);letter-spacing:0}.metric-note{font-size:11px;color:var(--muted)}.error-text{color:var(--red)}
    .charts{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}
    h2{font-size:14px;font-weight:600;letter-spacing:-.1px;margin:0}.card-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:20px}.card-head span{font-size:11px;color:var(--muted)}
    code{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
    .route+.route{margin-top:16px}.route-label{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:7px}.route-label strong{font-size:12px;font-weight:500;color:var(--muted)}
    .track{height:6px;background:#293128;border-radius:5px;overflow:hidden}.track span{display:block;height:100%;background:var(--green);border-radius:5px}
    .latency-chart{display:flex;gap:5px;align-items:end;height:150px;padding:0 0 1px;border-bottom:1px solid var(--line)}.latency-column{height:100%;flex:1;display:flex;align-items:end;min-width:0}.latency-column span{width:100%;background:var(--green);border-radius:3px 3px 0 0;opacity:.85}
    .error-bar{background:var(--red)!important}.chart-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:8px}.legend{display:flex;gap:16px;font-size:11px;color:var(--muted);margin-top:18px}.legend i{display:inline-block;width:7px;height:7px;border-radius:2px;background:var(--green);margin-right:6px}.legend .red{background:var(--red)}
    .table-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px}.table-heading h2{font-size:17px}.count{font-size:12px;color:var(--muted);margin-left:10px;font-weight:400}
    .controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.filters{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:3px}
    button{border:0;border-radius:5px;padding:6px 10px;font-size:11px;background:transparent;color:var(--muted)}button[aria-pressed="true"]{background:#35422b;color:var(--green)}
    input,select{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;font-size:11px;padding:10px}input{width:165px}input::placeholder{color:var(--muted)}
    .table-wrap{border:1px solid var(--line);border-radius:12px;overflow:auto;background:var(--panel)}table{border-collapse:collapse;width:100%;text-align:left}th{font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;padding:12px 16px;background:#1d241e}td{padding:12px 16px;border-top:1px solid #29322b;font-size:12px}tbody tr:not([hidden]):hover{background:#222b23}.muted{color:var(--muted)}.duration{font-variant-numeric:tabular-nums;white-space:nowrap}.latency-cell{width:23%}.latency-cell .track{height:4px}
    .status{font:11px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--green);background:#2c3922;padding:4px 7px;border-radius:5px}.status.error{background:#3b2b26;color:var(--red)}.status.warning{background:#3b3626;color:#efcf85}
    .empty{padding:24px;text-align:center;color:var(--muted);font-size:13px}[hidden]{display:none!important}footer{display:flex;justify-content:space-between;gap:20px;color:var(--muted);font-size:10px;margin-top:20px}label.sr-only{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}
    @media(max-width:760px){.wrap{padding:20px 18px}.intro{align-items:start;flex-direction:column;gap:12px}h1{font-size:32px}.metrics{grid-template-columns:1fr 1fr}.charts{grid-template-columns:1fr}.table-heading{align-items:start;flex-direction:column}.controls{width:100%}input{flex:1;min-width:120px}.latency-cell,th:last-child{display:none}header{gap:16px}footer{flex-direction:column;gap:5px}}
  </style>
</head>
<body>
<main class="wrap">
  <header><div class="brand"><span class="brand-icon" aria-hidden="true">r</span>Request Report</div><div class="file">${escape(basename(source))}</div></header>
  <div class="intro"><div><div class="eyebrow">Traffic, at a glance</div><h1>How did your app hold up?</h1><p>A closer look at the requests in this log.</p></div><div class="summary-pill"><span class="dot"></span>${report.errors ? `${report.errors} server errors to investigate` : 'No server errors in this log'}</div></div>
  <section class="metrics" aria-label="Log summary">
    <div class="card"><div class="metric-label">Total requests</div><div class="metric-value">${report.requests}</div><div class="metric-note">Every request in the file</div></div>
    <div class="card"><div class="metric-label">Server errors</div><div class="metric-value error-text">${report.errors}<small>/ ${report.requests}</small></div><div class="metric-note">${errorRate}% returned a 5xx status</div></div>
    <div class="card"><div class="metric-label">p95 latency</div><div class="metric-value">${report.p95Ms}<small>ms</small></div><div class="metric-note">95th percentile, nearest rank</div></div>
    <div class="card"><div class="metric-label">Distinct paths</div><div class="metric-value">${routes.length}</div><div class="metric-note">Exact paths as logged</div></div>
  </section>
  <section class="charts" aria-label="Traffic charts">
    <div class="card"><div class="card-head"><h2>Where the traffic went</h2><span>Requests by path</span></div>${routeBars}</div>
    <div class="card"><div class="card-head"><h2>How long requests took</h2><span>Peak ${maxLatency === 1 && rows.every(row => row.durationMs === 0) ? 0 : maxLatency} ms</span></div><div class="latency-chart" role="img" aria-label="Request durations in log order. Exact values are in the table below.">${latencyBars}</div><div class="chart-axis"><span>First request</span><span>Last request</span></div><div class="legend"><span><i></i>Status below 500</span><span><i class="red"></i>Server error</span></div></div>
  </section>
  <div class="table-heading">
    <h2>Follow the requests<span class="count" id="count" role="status">${report.requests} of ${report.requests}</span></h2>
    <div class="controls">
      <div class="filters" aria-label="Filter by status"><button type="button" data-filter="all" aria-pressed="true">All requests</button><button type="button" data-filter="errors" aria-pressed="false">Server errors</button></div>
      <label for="search" class="sr-only">Search request paths</label><input type="search" id="search" placeholder="Search paths">
      <label for="sort" class="sr-only">Sort requests</label><select id="sort"><option value="order">Log order</option><option value="slowest">Slowest first</option></select>
    </div>
  </div>
  <div class="table-wrap"><table><thead><tr><th scope="col">#</th><th scope="col">Path</th><th scope="col">Status</th><th scope="col">Duration</th><th scope="col">Relative latency</th></tr></thead><tbody>${tableRows}</tbody></table><p class="empty" id="empty" hidden>No requests match these filters.</p></div>
  <footer><span>Generated by Request Report · ${escape(basename(source))}</span><span>Summary and charts show the full log; filters apply to the table.</span></footer>
</main>
<script>
  const table = document.querySelector('tbody');
  const rows = Array.from(table.rows);
  const search = document.querySelector('#search');
  const sort = document.querySelector('#sort');
  const buttons = document.querySelectorAll('[data-filter]');
  let filter = 'all';
  function update() {
    const query = search.value.toLowerCase();
    const sorted = rows.slice().sort((a, b) => sort.value === 'slowest'
      ? Number(b.dataset.latency) - Number(a.dataset.latency)
      : Number(a.dataset.index) - Number(b.dataset.index));
    let visible = 0;
    for (const row of sorted) {
      row.hidden = !(row.cells[1].textContent.toLowerCase().includes(query)
        && (filter === 'all' || Number(row.dataset.status) >= 500));
      if (!row.hidden) visible++;
      table.append(row);
    }
    document.querySelector('#count').textContent = visible + ' of ' + rows.length;
    document.querySelector('#empty').hidden = visible !== 0;
  }
  for (const button of buttons) button.addEventListener('click', () => {
    filter = button.dataset.filter;
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    update();
  });
  search.addEventListener('input', update);
  sort.addEventListener('change', update);
</script>
</body>
</html>
`
}
