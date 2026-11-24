"use client";

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import Icon, { type IconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { csvCell, sourceNumber } from './legacy-utils';
import './legacy.css';

type Period = 'daily' | 'monthly' | 'yearly';
type Snapshot = {
  id: string;
  sourceFile: string;
  sourceDatabase: string;
  snapshotAt: string;
  importedAt: string;
  recordCount: number;
  sourceCounts: Record<string, number>;
  reconciliation: unknown;
};
type Company = { id: number; name: string };
type SourceRow = {
  companyId: number | null;
  companyName: string;
  period: string;
  salesAmount: string | null;
  targetAmount: string | null;
  due: string | null;
  od: string | null;
  codOd: string | null;
};
type Summary = {
  snapshot: Snapshot;
  companies: Company[];
  period: Period;
  coverage: { from: string | null; to: string | null };
  totals: { salesAmount: string | null; targetAmount: string; rows: number };
  rows: SourceRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};
type SummaryState = {
  key: string;
  status: 'loading' | 'error' | 'success';
  data?: Summary;
  error?: string;
};

const periodLabels: Record<Period, string> = { daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly' };

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: IconName; tone: string }) {
  return <article className="card legacy-metric">
    <div className="legacy-metric-heading"><span>{label}</span><span className={`icon-tile ${tone}`}><Icon name={icon} size={19} /></span></div>
    <strong>{value}</strong><small>{note}</small>
  </article>;
}

export default function LegacySales() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [importsBusy, setImportsBusy] = useState(true);
  const [importsError, setImportsError] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState({ importId: '', period: 'daily' as Period, companyId: '', page: 1, pageSize: 50 });
  const [revision, setRevision] = useState(0);
  const [summaryState, setSummaryState] = useState<SummaryState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setImportsBusy(true);
    setImportsError('');
    api<Snapshot[]>('/legacy/imports', { signal: controller.signal }).then(items => {
      if (!active) return;
      setSnapshots(items);
      setFilters(current => items.some(item => item.id === current.importId) ? current : {
        ...current, importId: items[0]?.id || '', companyId: '', page: 1,
      });
    }).catch((error: unknown) => {
      if (active) setImportsError(error instanceof Error ? error.message : 'Could not load historical snapshots.');
    }).finally(() => { if (active) setImportsBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [revision]);

  const params = new URLSearchParams({
    importId: filters.importId,
    period: filters.period,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.companyId) params.set('companyId', filters.companyId);
  const query = params.toString();
  const requestKey = `${query}|${revision}`;

  useEffect(() => {
    if (!filters.importId) return;
    const controller = new AbortController();
    let active = true;
    setSummaryState({ key: requestKey, status: 'loading' });
    api<Summary>('/legacy/summary?' + query, { signal: controller.signal }).then(data => {
      if (!active) return;
      setCompanies(data.companies);
      setSummaryState({ key: requestKey, status: 'success', data });
    }).catch((error: unknown) => {
      if (active) setSummaryState({ key: requestKey, status: 'error', error: error instanceof Error ? error.message : 'Could not load source records.' });
    });
    return () => { active = false; controller.abort(); };
  }, [filters.importId, query, requestKey]);

  // Never render or export a response belonging to a previous filter selection.
  const current = summaryState?.key === requestKey ? summaryState : null;
  const data = current?.status === 'success' ? current.data : undefined;
  const busy = importsBusy || (!!filters.importId && (!current || current.status === 'loading'));
  const selectedSnapshot = snapshots.find(item => item.id === filters.importId);
  const coverage = data?.coverage.from ? `${data.coverage.from} — ${data.coverage.to || data.coverage.from}` : 'No dated records';

  function exportPage() {
    if (!data || busy) return;
    const rows = [
      ['Snapshot (source timezone unspecified)', 'Source file', 'Period', 'Company ID', 'Company', 'Sales amount (source)', 'Target amount (source)', 'Due (source)', 'OD (source)', 'COD OD (source)'],
      ...data.rows.map(row => [data.snapshot.snapshotAt, data.snapshot.sourceFile, row.period, row.companyId, row.companyName, row.salesAmount, row.targetAmount, row.due, row.od, row.codOd]),
    ];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `legacy-${data.period}-${data.snapshot.snapshotAt.slice(0, 10)}-page-${data.pagination.page}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <Topbar title="Legacy Sales & Targets" action={<button type="button" className="btn secondary" onClick={() => setRevision(value => value + 1)} disabled={busy}><Icon name="refresh" />Refresh</button>} />
    <div className="legacy-page">
      <section className="legacy-intro" aria-labelledby="legacy-intro-title">
        <span className="legacy-intro-icon"><Icon name="clock" size={26} /></span>
        <div><span className="legacy-kicker">HISTORICAL RECORDS</span><h2 id="legacy-intro-title">Your previous CRM, in view.</h2><p>Explore the sales and target summaries available in your imported backups. These records are kept separate from current customer balances and CRM totals.</p></div>
        <span className="legacy-readonly"><Icon name="lock" size={13} />Read only</span>
      </section>

      {importsError && <div className="error" role="alert"><span>{importsError}</span><button type="button" className="btn secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
      {!importsError && !snapshots.length && <section className="card legacy-state" role="status">
        <span className="empty-icon"><Icon name={importsBusy ? 'refresh' : 'receipt'} size={24} /></span>
        <h2>{importsBusy ? 'Loading historical snapshots…' : 'No historical snapshots yet'}</h2>
        <p>{importsBusy ? 'Preparing your source records.' : 'Imported sales and target summaries will appear here once a backup has been processed.'}</p>
      </section>}

      {!!snapshots.length && <>
        <section className="card legacy-controls" aria-label="Historical record filters">
          <div className="legacy-filter-grid">
            <div className="field"><label htmlFor="legacy-snapshot">Backup snapshot</label><select id="legacy-snapshot" value={filters.importId} onChange={event => { setCompanies([]); setFilters(current => ({ ...current, importId: event.target.value, companyId: '', page: 1 })); }} disabled={importsBusy}>
              {snapshots.map((item, index) => <option key={item.id} value={item.id}>{item.snapshotAt}{index === 0 ? ' · Latest' : ''} · {item.sourceFile}</option>)}
            </select></div>
            <div className="field"><label htmlFor="legacy-company">Source company</label><select id="legacy-company" value={filters.companyId} onChange={event => setFilters(current => ({ ...current, companyId: event.target.value, page: 1 }))}>
              <option value="">All source companies</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}<option value="none">Unassigned source company</option>
            </select></div>
          </div>
          <div className="legacy-control-footer">
            <fieldset className="legacy-period"><legend className="sr-only">Source period</legend>{(['daily', 'monthly', 'yearly'] as const).map(period => <label key={period}><input type="radio" name="legacy-period" value={period} checked={filters.period === period} onChange={() => setFilters(current => ({ ...current, period, page: 1 }))} /><span>{periodLabels[period]}</span></label>)}</fieldset>
            <p><Icon name="shield" size={14} />Each snapshot is viewed independently.</p>
          </div>
        </section>

        {selectedSnapshot && <div className="legacy-provenance"><span><Icon name="building" size={14} />{selectedSnapshot.sourceDatabase}</span><span><Icon name="calendar" size={14} />Snapshot: {selectedSnapshot.snapshotAt}</span><span>Source timezone unspecified</span></div>}

        {current?.status === 'error' && <section className="card legacy-state" role="alert"><span className="empty-icon"><Icon name="receipt" size={24} /></span><h2>Source records could not be loaded</h2><p>{current.error}</p><button type="button" className="btn secondary" onClick={() => setRevision(value => value + 1)}>Try again</button></section>}
        {busy && <section className="card legacy-state" role="status" aria-live="polite"><span className="empty-icon"><Icon name="refresh" size={24} /></span><h2>Loading {periodLabels[filters.period].toLowerCase()} records…</h2><p>Retrieving the selected snapshot and company.</p></section>}

        {data && !busy && <>
          <div className="legacy-metrics">
            <Metric label="Sales amount (source)" value={sourceNumber(data.totals.salesAmount)} note={data.period === 'yearly' ? 'Yearly sales are not present in this source.' : `${periodLabels[data.period]} dataset · all matching rows`} icon="receipt" tone="blue" />
            <Metric label="Target amount (source)" value={sourceNumber(data.totals.targetAmount)} note={data.period === 'yearly' ? 'Fiscal-year labels retained from the source.' : `${periodLabels[data.period]} dataset · all matching rows`} icon="briefcase" tone="amber" />
            <Metric label="Matching period records" value={sourceNumber(String(data.totals.rows))} note={coverage} icon="calendar" tone="violet" />
          </div>

          <div className="legacy-source-note"><Icon name="shield" size={18} /><p><strong>Figures as recorded in the source.</strong> Daily, monthly and yearly summaries are separate datasets; their totals are not combined. No currency is assumed. OD and COD OD retain their original names until their definitions are confirmed.</p></div>

          <section className="card legacy-records" aria-labelledby="legacy-records-title">
            <div className="legacy-table-heading"><div><h2 id="legacy-records-title">{periodLabels[data.period]} source records</h2><p>Sales and targets matched by source company and period. A dash means no source value.</p></div><button type="button" className="btn secondary" onClick={exportPage} disabled={!data.rows.length}><Icon name="receipt" />Export this page (CSV)</button></div>
            {data.rows.length ? <div className="table-wrap legacy-table-wrap" tabIndex={0} role="region" aria-label="Source records table; scroll horizontally to see all columns"><table className="table legacy-table">
              <caption className="sr-only">{periodLabels[data.period]} sales and target records from snapshot {data.snapshot.snapshotAt}. Amounts use the original source precision.</caption>
              <thead><tr><th scope="col">Period</th><th scope="col">Source company</th><th scope="col">Sales amount<span>(source)</span></th><th scope="col">Target amount<span>(source)</span></th><th scope="col">Due<span>(source)</span></th><th scope="col">OD<span>(source)</span></th><th scope="col">COD OD<span>(source)</span></th></tr></thead>
              <tbody>{data.rows.map(row => <tr key={`${row.companyId ?? 'none'}:${row.period}`}><th scope="row">{row.period}</th><td><strong>{row.companyName || 'Unassigned source company'}</strong><small>{row.companyId === null ? 'No source company ID' : `Source ID: ${row.companyId}`}</small></td><td>{sourceNumber(row.salesAmount)}</td><td>{sourceNumber(row.targetAmount)}</td><td>{sourceNumber(row.due)}</td><td>{sourceNumber(row.od)}</td><td>{sourceNumber(row.codOd)}</td></tr>)}</tbody>
            </table></div> : <div className="legacy-state"><span className="empty-icon"><Icon name="search" size={24} /></span><h3>No matching source records</h3><p>Choose another company, period or backup snapshot.</p></div>}
            <div className="legacy-pagination">
              <div className="legacy-page-size"><label htmlFor="legacy-page-size">Rows per page</label><select id="legacy-page-size" value={filters.pageSize} onChange={event => setFilters(current => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><span aria-live="polite">{data.pagination.total ? `${(data.pagination.page - 1) * data.pagination.pageSize + 1}–${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of ${data.pagination.total}` : '0 records'}</span></div>
              <nav aria-label="Source records pagination"><button type="button" className="btn secondary" disabled={data.pagination.page <= 1} onClick={() => setFilters(current => ({ ...current, page: Math.max(1, current.page - 1) }))}><Icon name="chevron" className="legacy-previous" />Previous</button><span>Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button type="button" className="btn secondary" disabled={data.pagination.page >= data.pagination.pages} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Next<Icon name="chevron" /></button></nav>
            </div>
          </section>
          <p className="legacy-footnote"><Icon name="clock" size={14} />Source file: {data.snapshot.sourceFile}. Viewing this historical snapshot does not change live CRM records.</p>
        </>}
      </>}
    </div>
  </>;
}
