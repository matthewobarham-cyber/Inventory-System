import { useMemo, useState } from 'react';
import { interpretCsv } from '../csv-import.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';

const cardStyle = { padding: 16, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10 };

export default function CsvImport({ importRuns, procurementRecords, canImport, onCommit }) {
  const [tab, setTab] = useState('import');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const summary = useMemo(() => files.reduce((total, file) => ({ assets: total.assets + file.assets.length, procurement: total.procurement + file.procurement.length, warnings: total.warnings + file.warnings.length }), { assets: 0, procurement: 0, warnings: 0 }), [files]);

  const readFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const interpreted = [];
      for (const file of selected) interpreted.push(interpretCsv(await file.text(), file.name));
      setFiles(interpreted);
      if (!interpreted.some((file) => file.assets.length || file.procurement.length)) setError('No importable records were found in the selected files.');
    } catch (readError) {
      setFiles([]);
      setError(readError.message || 'The CSV files could not be read.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const commit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const committed = await onCommit({ files, assets: files.flatMap((file) => file.assets), procurement: files.flatMap((file) => file.procurement) });
      setResult(committed);
      if (committed?.error) setError(committed.error);
      else setFiles([]);
    } catch (commitError) {
      setError(commitError?.message || 'The interpreted CSV data could not be stored.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1240, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {[['import', 'Import workspace'], ['procurement', `Procurement archive (${procurementRecords.length})`], ['history', `Import history (${importRuns.length})`]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={tab === key ? 'btn-primary' : 'btn-ghost'} style={{ height: 35, padding: '0 13px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{label}</button>
        ))}
      </div>

      {tab === 'import' && (
        <>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <strong style={{ fontSize: 14 }}>Read and interpret CSV files</strong>
              <span style={{ color: '#6f7c89', fontSize: 12, lineHeight: 1.45 }}>Supports the MSBM inventory list, fixed-asset schedule, procurement tracker, and Amazon purchasing list. Files are analyzed before anything is stored.</span>
            </span>
            {canImport ? <label className="btn-primary" style={{ height: 38, padding: '0 15px', display: 'flex', alignItems: 'center', borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{busy ? 'Reading…' : 'Choose CSV files'}<input type="file" multiple accept=".csv,text/csv" disabled={busy} onChange={readFiles} hidden /></label>
              : <span style={{ padding: '7px 10px', borderRadius: 7, background: '#f1f2f4', color: '#5b6672', fontSize: 11.5 }}>View only</span>}
          </div>
          {!!error && <div style={{ padding: '10px 12px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12 }}>{error}</div>}
          {result && !result.error && <div style={{ padding: '10px 12px', background: '#e7f4ec', border: '1px solid #c7e5d4', borderRadius: 8, color: '#155e3f', fontSize: 12 }}>Imported {result.assets} asset records and {result.procurement} procurement records. {result.skipped} duplicates were skipped. {result.cloud ? 'The shared Supabase archive and local cache are up to date.' : 'The local archive is up to date.'}</div>}
          {!!files.length && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 13, borderBottom: '1px solid #eceff3' }}>
                <span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13.5 }}>Interpretation preview</strong><span style={{ fontSize: 11.5, color: '#7b8794' }}>{summary.assets} assets · {summary.procurement} procurement records · {files.length} files</span></span>
                <button type="button" className="btn-ghost" onClick={() => setFiles([])} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12 }}>Clear</button>
                <button type="button" onClick={commit} disabled={busy || (!summary.assets && !summary.procurement)} style={{ height: 36, padding: '0 15px', border: '1px solid #12633f', borderRadius: 8, background: '#16794f', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Storing dataâ€¦' : 'Store interpreted data'}</button>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 9 }}>
                {files.map((file) => <div key={file.fileName} style={{ padding: '11px 12px', display: 'grid', gridTemplateColumns: '1.6fr 1fr .6fr .7fr', gap: 12, alignItems: 'center', background: '#f7f9fb', borderRadius: 8 }}>
                  <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>{file.fileName}</strong><small style={{ color: '#7b8794' }}>{file.rowCount.toLocaleString()} populated CSV rows</small></span>
                  <span style={{ color: '#0a3d7c', fontSize: 12, fontWeight: 600 }}>{file.type}</span>
                  <span style={{ fontSize: 11.5 }}>{file.assets.length} assets</span>
                  <span style={{ fontSize: 11.5 }}>{file.procurement.length} purchases</span>
                </div>)}
              </div>
              <PreviewRows files={files} />
            </div>
          )}
        </>
      )}

      {tab === 'procurement' && <ProcurementArchive records={procurementRecords} />}
      {tab === 'history' && <ImportHistory runs={importRuns} />}
    </div>
  );
}

function PreviewRows({ files }) {
  const rows = [...files.flatMap((file) => file.assets.map((record) => ({ type: 'Asset', name: record.name, detail: record.tag || record.serial || record.room, source: file.fileName }))), ...files.flatMap((file) => file.procurement.map((record) => ({ type: 'Procurement', name: record.description, detail: `${record.vendor} · ${record.status}`, source: file.fileName })))].slice(0, 10);
  return <div style={{ marginTop: 15 }}><div style={{ marginBottom: 7, fontSize: 11, fontWeight: 700, color: '#6f7c89', letterSpacing: '.07em', textTransform: 'uppercase' }}>Sample interpreted records</div>{rows.map((row, index) => <div key={`${row.source}-${index}`} style={{ padding: '8px 2px', display: 'grid', gridTemplateColumns: '90px 1.4fr 1fr', gap: 12, borderTop: '1px solid #f0f2f5', fontSize: 11.5 }}><span style={{ color: '#0a3d7c', fontWeight: 600 }}>{row.type}</span><span>{row.name}</span><span style={{ color: '#7b8794' }}>{row.detail || 'No reference recorded'}</span></div>)}</div>;
}

function ProcurementArchive({ records }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'description', direction: 'asc' });
  const filtered = records.filter((record) => [record.description, record.vendor, record.requisition, record.purchaseOrder, record.category].join(' ').toLowerCase().includes(query.toLowerCase()));
  const sorted = sortRows(filtered, sort, { description: (row) => row.description, vendor: (row) => row.vendor, quantity: (row) => Number(row.quantity || 0), status: (row) => row.status, reference: (row) => row.requisition || row.purchaseOrder || row.link || '' });
  return <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e5e9ee' }}><span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13.5 }}>Imported procurement archive</strong><small style={{ color: '#7b8794' }}>Historical and planned purchases extracted from company CSV files</small></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendor, item or PO…" style={{ width: 280, height: 34, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 12 }} /></div><div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .65fr .8fr 1fr', gap: 12, padding: '9px 14px', background: '#f7f9fb', color: '#7b8794', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>{[['description', 'Description'], ['vendor', 'Vendor'], ['quantity', 'Quantity'], ['status', 'Status'], ['reference', 'References']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} />)}</div>{sorted.slice(0, 500).map((record) => <div key={record.id || record.importKey} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr .65fr .8fr 1fr', gap: 12, padding: '10px 14px', borderTop: '1px solid #f0f2f5', fontSize: 11.5 }}><span><strong style={{ display: 'block', fontWeight: 500 }}>{record.description}</strong><small style={{ color: '#8a96a2' }}>{record.category}</small></span><span>{record.vendor}</span><span>{record.quantity}</span><span>{record.status}</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5 }}>{record.requisition || record.purchaseOrder || record.link || '—'}</span></div>)}{!filtered.length && <div style={{ padding: 42, textAlign: 'center', color: '#7b8794', fontSize: 12.5 }}>No procurement records have been imported.</div>}</div>;
}

function ImportHistory({ runs }) {
  return <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>{runs.map((run) => <div key={run.id} style={{ padding: '12px 15px', display: 'grid', gridTemplateColumns: '1.5fr .8fr .8fr 1fr', gap: 12, borderBottom: '1px solid #f0f2f5', fontSize: 12 }}><span><strong style={{ display: 'block' }}>{run.files.join(', ')}</strong><small style={{ color: '#7b8794' }}>Imported by {run.by}</small></span><span>{run.assets} assets</span><span>{run.procurement} purchases</span><span style={{ color: '#6f7c89' }}>{run.when}</span></div>)}{!runs.length && <div style={{ padding: 42, textAlign: 'center', color: '#7b8794', fontSize: 12.5 }}>No CSV imports have been completed yet.</div>}</div>;
}
