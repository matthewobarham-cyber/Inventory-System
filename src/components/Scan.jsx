import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { effStatus, isLowStock, thumbStyle } from '../data.js';
import ScannerLabelStudio from './ScannerLabelStudio.jsx';

const MODES = [
  { id: 'smart', icon: '⌁', label: 'Smart action', detail: 'Automatically return loans, issue consumables, or start checkout.' },
  { id: 'lookup', icon: '⌕', label: 'Find asset', detail: 'Open the complete inventory record without changing its status.' },
  { id: 'checkout', icon: '↗', label: 'Check out', detail: 'Open borrower details and the custody agreement.' },
  { id: 'checkin', icon: '↙', label: 'Check in', detail: 'Open condition inspection and return processing.' },
  { id: 'consume', icon: '−', label: 'Issue stock', detail: 'Open quantity-based issuing for a scanned consumable.' },
  { id: 'register', icon: '+', label: 'Register label', detail: 'Turn a generated blank barcode into a new inventory item.' }
];

const modeNeedsManagement = (mode) => ['smart', 'checkout', 'checkin', 'consume', 'register'].includes(mode);

function scannerTone(success) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(success ? 720 : 210, context.currentTime);
    if (success) oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + .08);
    gain.gain.setValueAtTime(.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + .14);
  } catch { /* Audio feedback is best effort. */ }
}

function ScannerMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 7H7v10M37 7h4v10M11 41H7V31m30 10h4V31M13 14v20m5-20v20m5-20v20m7-20v20m5-20v20M26 14v20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
}

function Scan({ items, recentScans, reservedBarcodes = [], canManageLoans, isActive = true, onScan, onSimulate, onOpenItem, onOpenStocktakes, onGenerateBlankLabels }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState(canManageLoans ? 'smart' : 'lookup');
  const [feedback, setFeedback] = useState(null);
  const [scanLog, setScanLog] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const [listening, setListening] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const scannerBuffer = useRef('');
  const lastKeyAt = useRef(0);
  const lastSubmitted = useRef({ value: '', mode: '', at: 0 });

  const focusScanner = useCallback(() => requestAnimationFrame(() => inputRef.current?.focus()), []);
  const selectedMode = MODES.find((entry) => entry.id === mode) || MODES[0];
  const activeReservations = useMemo(() => reservedBarcodes.filter((entry) => entry.status !== 'Voided'), [reservedBarcodes]);
  const recent = useMemo(() => recentScans.map((id) => items.find((item) => item.id === id)).filter(Boolean), [items, recentScans]);
  const metrics = useMemo(() => ({
    records: items.length,
    loaned: items.filter((item) => item.status === 'On loan').length,
    attention: items.filter((item) => item.status === 'Maintenance' || isLowStock(item)).length,
    labels: activeReservations.length
  }), [activeReservations.length, items]);
  const successes = scanLog.filter((entry) => !entry.error).length;
  const failures = scanLog.length - successes;
  const suggestions = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (needle.length < 2) return [];
    return items.filter((item) => `${item.name} ${item.tag} ${item.serial || ''}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [items, text]);

  const submit = useCallback((value, forcedMode = mode) => {
    const normalized = String(value || '').trim();
    setShowSuggestions(false);
    if (!normalized) {
      setFeedback({ error: true, title: 'Nothing to process', text: 'Scan a barcode or enter an asset tag or serial number.' });
      focusScanner();
      return;
    }
    const now = Date.now();
    if (lastSubmitted.current.value.toUpperCase() === normalized.toUpperCase() && lastSubmitted.current.mode === forcedMode && now - lastSubmitted.current.at < 900) {
      setFeedback({ error: true, warning: true, title: 'Duplicate scan blocked', text: 'The same barcode was received twice in under one second. No second action was performed.' });
      setText(''); focusScanner(); return;
    }
    lastSubmitted.current = { value: normalized, mode: forcedMode, at: now };
    const result = onScan(normalized, forcedMode) || {};
    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`, value: normalized, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      item: result.item, reservation: result.reservation, action: result.action, error: result.error, mode: forcedMode
    };
    setScanLog((current) => [entry, ...current].slice(0, 30));
    setFeedback(result.error
      ? { error: true, title: 'Scan needs attention', text: result.error, item: result.item, reservation: result.reservation, value: normalized }
      : { error: false, title: result.item?.name || result.reservation?.equipmentType || 'Barcode accepted', text: result.action || 'Scan processed', item: result.item, reservation: result.reservation, value: normalized });
    if (soundOn) scannerTone(!result.error);
    setText('');
    if (!result.navigation) focusScanner();
  }, [focusScanner, mode, onScan, soundOn]);

  useEffect(() => {
    if (!isActive) return undefined;
    focusScanner();
    const listenForScanner = (event) => {
      if (!listening) return;
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (isEditing || event.ctrlKey || event.altKey || event.metaKey) return;
      const now = Date.now();
      if (now - lastKeyAt.current > 180) scannerBuffer.current = '';
      lastKeyAt.current = now;
      if (event.key === 'Enter' || event.key === 'Tab') {
        const scannedValue = scannerBuffer.current.trim();
        scannerBuffer.current = '';
        if (scannedValue.length >= 4) { event.preventDefault(); submit(scannedValue); }
      } else if (event.key.length === 1) scannerBuffer.current += event.key;
    };
    document.addEventListener('keydown', listenForScanner);
    return () => document.removeEventListener('keydown', listenForScanner);
  }, [focusScanner, isActive, listening, submit]);

  const chooseMode = (nextMode) => {
    setMode(nextMode); setFeedback(null); setShowSuggestions(false); focusScanner();
  };
  const simulate = () => {
    const value = onSimulate();
    if (value) submit(value);
  };

  return <div className="scanner-workspace">
    <section className="scanner-hero">
      <div className="scanner-hero-copy">
        <span className="scanner-kicker">Barcode operations</span>
        <h2>Scanner command console</h2>
        <p>Identify equipment and immediately route it into checkout, return, consumable issuing, stocktake, or new-item registration.</p>
        <div className="scanner-health">
          <span className={listening ? 'online' : 'paused'}><i />{listening ? 'Scanner listening' : 'Scanner paused'}</span>
          <span>USB keyboard mode</span><span>Enter / Tab suffix</span>
        </div>
      </div>
      <div className="scanner-visual" aria-hidden="true"><div><ScannerMark /><i /></div></div>
      <div className="scanner-hero-metrics">
        <span><strong>{metrics.records.toLocaleString()}</strong><small>searchable records</small></span>
        <span><strong>{metrics.loaned}</strong><small>currently loaned</small></span>
        <span><strong>{metrics.attention}</strong><small>need attention</small></span>
        <span><strong>{metrics.labels}</strong><small>blank labels ready</small></span>
      </div>
    </section>

    <section className="scanner-console-grid">
      <div className="scanner-capture-card">
        <header><span><small>Live capture</small><strong>{selectedMode.label}</strong></span><button type="button" className={`scanner-listen-toggle ${listening ? 'active' : ''}`} onClick={() => setListening((current) => !current)}><i />{listening ? 'Listening' : 'Paused'}</button></header>
        <div className="scanner-input-shell">
          <ScannerMark />
          <label htmlFor="scanner-input"><span>Scan, asset tag, or serial number</span><input id="scanner-input" ref={inputRef} value={text} disabled={!listening}
            onFocus={() => setShowSuggestions(true)} onChange={(event) => { setText(event.target.value); setFeedback(null); setShowSuggestions(true); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); submit(text); } if (event.key === 'Escape') setShowSuggestions(false); }}
            placeholder="MSBM/COM/724/08/2026" autoComplete="off" /></label>
          <button type="button" onClick={() => submit(text)} disabled={!listening}>Process scan</button>
          {showSuggestions && suggestions.length > 0 && <div className="scanner-suggestions">
            {suggestions.map((item) => <button key={item.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => submit(item.tag)}><span style={thumbStyle(item.model, 32, 6)} /><span><strong>{item.name}</strong><small>{item.tag}{item.serial ? ` · ${item.serial}` : ''}</small></span><b>{effStatus(item)}</b></button>)}
          </div>}
        </div>
        <div className="scanner-capture-actions">
          <button type="button" onClick={simulate}>Test with sample asset</button>
          <button type="button" onClick={() => setSoundOn((current) => !current)}>Sound {soundOn ? 'on' : 'off'}</button>
          <button type="button" onClick={() => { setFeedback(null); setText(''); focusScanner(); }}>Clear input</button>
        </div>
        <div className="scanner-session-strip"><span><b>{scanLog.length}</b> scans this session</span><span className="success"><b>{successes}</b> successful</span><span className={failures ? 'failure' : ''}><b>{failures}</b> exceptions</span></div>
      </div>

      <div className="scanner-mode-card">
        <header><span><small>Workflow routing</small><strong>What should each scan do?</strong></span><p>Smart action is recommended for normal counter operation.</p></header>
        <div className="scanner-mode-list">
          {MODES.map((entry) => {
            const disabled = !canManageLoans && modeNeedsManagement(entry.id);
            return <button key={entry.id} type="button" disabled={disabled} className={mode === entry.id ? 'active' : ''} onClick={() => chooseMode(entry.id)}><i>{entry.icon}</i><span><strong>{entry.label}{entry.id === 'smart' && <em>Recommended</em>}</strong><small>{entry.detail}</small></span><b aria-hidden="true" /></button>;
          })}
        </div>
      </div>
    </section>

    <ScannerLabelStudio items={items} />

    {feedback && <section className={`scanner-result ${feedback.error ? feedback.warning ? 'warning' : 'error' : 'success'}`} role="status">
      <div className="scanner-result-mark">{feedback.error ? feedback.warning ? '!' : '×' : '✓'}</div>
      <div><small>{feedback.error ? 'Scanner response' : 'Action completed'}</small><strong>{feedback.title}</strong><p>{feedback.text}</p>{feedback.value && <code>{feedback.value}</code>}</div>
      <div className="scanner-result-actions">
        {feedback.item && <button type="button" onClick={() => onOpenItem(feedback.item.id)}>View full record</button>}
        {feedback.reservation && feedback.error && <button type="button" className="primary" onClick={() => submit(feedback.value, 'register')}>Register new item</button>}
        <button type="button" onClick={() => { setFeedback(null); focusScanner(); }}>Scan another</button>
      </div>
    </section>}

    <section className="scanner-lower-grid">
      <div className="scanner-activity-card">
        <header><span><small>Current workstation session</small><strong>Scan activity</strong></span>{scanLog.length > 0 && <button type="button" onClick={() => { setScanLog([]); setFeedback(null); }}>Clear session</button>}</header>
        <div className="scanner-activity-head"><span>Time</span><span>Barcode / asset</span><span>Workflow</span><span>Result</span></div>
        {scanLog.length === 0 ? <div className="scanner-empty"><ScannerMark /><strong>Ready for the first barcode</strong><span>Scans processed from this console will be recorded here.</span></div> : scanLog.map((entry) => <div className="scanner-activity-row" key={entry.id}>
          <time>{entry.at}</time><span><strong>{entry.item?.name || entry.reservation?.equipmentType || 'Unmatched barcode'}</strong><code>{entry.item?.tag || entry.reservation?.tag || entry.value}</code></span><b>{MODES.find((item) => item.id === entry.mode)?.label || entry.mode}</b><em className={entry.error ? 'error' : 'success'}>{entry.error || entry.action}</em>
        </div>)}
      </div>

      <aside className="scanner-side-column">
        <section className="scanner-quick-card"><header><small>Related tools</small><strong>Scanner workflows</strong></header><button type="button" onClick={onOpenStocktakes}><i>✓</i><span><strong>Physical stocktake</strong><small>Verify a building or room by barcode</small></span><b>→</b></button><button type="button" onClick={onGenerateBlankLabels}><i>▥</i><span><strong>Generate blank labels</strong><small>Create categorized labels for new stock</small></span><b>→</b></button></section>
        <section className="scanner-recent-card"><header><span><small>Recent matches</small><strong>Previously scanned</strong></span><b>{recent.length}</b></header>{recent.length === 0 ? <p>No matched assets yet.</p> : recent.map((item) => <button key={item.id} type="button" onClick={() => onOpenItem(item.id)}><span style={thumbStyle(item.model, 34, 6)} /><span><strong>{item.name}</strong><small>{item.tag}</small></span><em data-status={effStatus(item).toLowerCase().replaceAll(' ', '-')}>{effStatus(item)}</em></button>)}</section>
      </aside>
    </section>
  </div>;
}

export default memo(Scan, (previous, next) => previous.items === next.items
  && previous.recentScans === next.recentScans
  && previous.reservedBarcodes === next.reservedBarcodes
  && previous.canManageLoans === next.canManageLoans
  && previous.isActive === next.isActive);
