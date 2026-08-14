import { useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS, iso, money, thumbStyle, today } from "../data.js";
import {
  bookValueFor,
  expectedReplacementFor,
  lifecycleFlags,
} from "../lifecycle.js";
import { IconX } from "../icons.jsx";
import SortableHeader, { nextSort, sortRows } from "./SortableHeader.jsx";
import StocktakeFlag from "./StocktakeFlag.jsx";

const ACTION_TYPES = ["Transfer", "Disposal", "Donation", "Loss", "Write-off"];
const ACTIVE_ACTIONS = ["Pending approval", "Approved"];
const ASSETS_PER_PAGE = 50;
const LIFECYCLE_CATEGORIES = [
  "Computers",
  "Displays",
  "Printing",
  "Networking",
  "Classroom AV",
  "Audio",
  "Communications",
  "Peripherals",
  "Storage",
  "Power",
  "Imaging",
  "Inventory tools",
  "Cables & adapters",
  "Printer consumables",
  "Other equipment",
];

function lifecycleCategoryFor(item) {
  const recorded = String(item.category || "").trim();
  const exact = LIFECYCLE_CATEGORIES.find(
    (category) => category.toLowerCase() === recorded.toLowerCase(),
  );
  if (exact) return exact;
  const text = `${recorded} ${item.name || ""} ${item.model || ""}`.toLowerCase();
  if (/laptop|desktop|computer|workstation|tablet/.test(text)) return "Computers";
  if (/monitor|display|screen/.test(text)) return "Displays";
  if (/toner|imaging unit|transfer belt|printer supply/.test(text)) return "Printer consumables";
  if (/printer|plotter|copier/.test(text)) return "Printing";
  if (/router|switch|network|wi-?fi|access point|ethernet/.test(text)) return "Networking";
  if (/projector|presentation|classroom/.test(text)) return "Classroom AV";
  if (/microphone|speaker|mixer|audio|headset/.test(text)) return "Audio";
  if (/phone|webcam|conference|communication/.test(text)) return "Communications";
  if (/keyboard|mouse|dock|peripheral/.test(text)) return "Peripherals";
  if (/drive|storage|nas|ssd|hard disk/.test(text)) return "Storage";
  if (/ups|power|charger|battery|surge/.test(text)) return "Power";
  if (/camera|scanner|imaging/.test(text)) return "Imaging";
  if (/barcode|inventory|label/.test(text)) return "Inventory tools";
  if (/cable|adapter|connector|hdmi|usb/.test(text)) return "Cables & adapters";
  return "Other equipment";
}
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function actionTone(status) {
  if (status === "Approved" || status === "Completed")
    return { background: "#e7f4ec", color: "#155e3f" };
  if (status === "Rejected") return { background: "#fdeceb", color: "#a01a12" };
  return { background: "#fdf0e0", color: "#8a5209" };
}

function StatusBadge({ status }) {
  return (
    <span
      style={{
        ...actionTone(status),
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function blankAction(itemId = "") {
  return {
    itemId,
    type: "Transfer",
    effectiveDate: iso(today()),
    justification: "",
    recipient: "",
    destinationBuilding: "",
    destinationRoom: "",
    vendor: "",
    disposalMethod: "",
    incidentReference: "",
    proceeds: 0,
    dataSanitization: "",
    documents: [],
  };
}

function lifecyclePosition(item) {
  const start = new Date(item.purchased || Date.now());
  const end = new Date(expectedReplacementFor(item) || Date.now());
  const now = new Date();
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return {
      percent: 0,
      stage: "Not configured",
      tone: "neutral",
      remaining: "Add lifecycle dates",
    };
  }
  const raw =
    ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) *
    100;
  const percent = Math.max(0, Math.min(100, Math.round(raw)));
  const days = Math.ceil((end.getTime() - now.getTime()) / 864e5);
  if (raw >= 100)
    return {
      percent: 100,
      stage: "Replacement due",
      tone: "critical",
      remaining: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
    };
  if (raw >= 85)
    return {
      percent,
      stage: "Lifecycle review",
      tone: "warning",
      remaining: `${days} days remaining`,
    };
  if (raw >= 50)
    return {
      percent,
      stage: "Mature service",
      tone: "mature",
      remaining: `${days} days remaining`,
    };
  if (raw >= 15)
    return {
      percent,
      stage: "Active service",
      tone: "healthy",
      remaining: `${days} days remaining`,
    };
  return {
    percent,
    stage: "Early lifecycle",
    tone: "new",
    remaining: `${days} days remaining`,
  };
}

function LifecycleAssetCard({ item, canManage, onConfigure, onOpen }) {
  const flags = lifecycleFlags(item);
  const life = lifecyclePosition(item);
  const value = bookValueFor(item);
  const cost = Math.max(0, Number(item.cost) || 0);
  const retained = cost
    ? Math.max(0, Math.min(100, Math.round((value / cost) * 100)))
    : 0;

  return (
    <article className={`lifecycle-asset-card lifecycle-tone-${life.tone}`} data-stocktake-state={item.stocktakeState || undefined}>
      <div className="lifecycle-card-accent" />
      <div className="lifecycle-card-main">
        <div className="lifecycle-asset-identity">
          <button
            type="button"
            className="lifecycle-asset-open"
            onClick={() => onOpen(item.id)}
          >
            <span
              className="lifecycle-asset-thumb"
              style={thumbStyle(item.model, 48, 8)}
            />
            <span>
              <small>{item.type || "Equipment"}</small>
              <strong>{item.name}<StocktakeFlag item={item} /></strong>
              <span>
                {item.tag} · {item.location} {item.room}
              </span>
            </span>
          </button>
          <span
            className={`lifecycle-stage-badge lifecycle-stage-${life.tone}`}
          >
            <i />
            {life.stage}
          </span>
        </div>

        <div className="lifecycle-life-panel">
          <div className="lifecycle-life-heading">
            <span>
              <small>Asset life used</small>
              <strong>{life.percent}%</strong>
            </span>
            <span className="lifecycle-time-remaining">{life.remaining}</span>
          </div>
          <div
            className="lifecycle-life-track"
            role="progressbar"
            aria-label={`${item.name} lifecycle progress`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={life.percent}
          >
            <span
              className="lifecycle-life-fill"
              style={{ width: `${life.percent}%` }}
            />
            {[25, 50, 75].map((marker) => (
              <i
                key={marker}
                className={life.percent >= marker ? "reached" : ""}
                style={{ left: `${marker}%` }}
              />
            ))}
          </div>
          <div className="lifecycle-life-labels">
            <span>
              Purchased
              <br />
              <b>{item.purchased || "Not recorded"}</b>
            </span>
            <span>Mid-life</span>
            <span>
              Replacement
              <br />
              <b>{flags.replacement || "Not configured"}</b>
            </span>
          </div>
        </div>

        <div className="lifecycle-card-details">
          <div>
            <small>Current book value</small>
            <strong className="lifecycle-money">{money(value)}</strong>
            <span>{retained}% of purchase value</span>
          </div>
          <div>
            <small>Depreciation</small>
            <strong>{item.depreciationMethod || "Straight-line"}</strong>
            <span>{item.usefulLifeYears || 5}-year useful life</span>
          </div>
          <div>
            <small>Warranty coverage</small>
            <strong
              className={
                flags.warrantyExpired
                  ? "lifecycle-danger-text"
                  : flags.warrantySoon
                    ? "lifecycle-warning-text"
                    : ""
              }
            >
              {item.warranty || "Not recorded"}
            </strong>
            <span>
              {flags.warrantyExpired
                ? "Coverage expired"
                : flags.warrantySoon
                  ? "Ending within 90 days"
                  : item.warranty
                    ? "Coverage on record"
                    : "Needs configuration"}
            </span>
          </div>
        </div>
      </div>
      <div className="lifecycle-card-actions">
        <button
          type="button"
          className="lifecycle-view-button"
          onClick={() => onOpen(item.id)}
        >
          View asset
        </button>
        {canManage && (
          <button
            type="button"
            className="lifecycle-configure-button"
            onClick={() => onConfigure(item)}
          >
            Configure lifecycle
          </button>
        )}
      </div>
    </article>
  );
}

function LifecycleAssetModal({ item, actions, canManage, onClose, onConfigure, onOpenFullRecord }) {
  const life = lifecyclePosition(item);
  const flags = lifecycleFlags(item);
  const bookValue = bookValueFor(item);
  const cost = Math.max(0, Number(item.cost) || 0);
  const depreciation = Math.max(0, cost - bookValue);
  const retained = cost ? Math.max(0, Math.min(100, Math.round((bookValue / cost) * 100))) : 0;
  const itemActions = actions.filter((action) => action.itemId === item.id).slice().sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));

  return <div style={backdrop} className="lifecycle-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`lifecycle-preview-modal lifecycle-tone-${life.tone}`} role="dialog" aria-modal="true" aria-labelledby="lifecycle-preview-title">
      <header className="lifecycle-preview-header">
        <div className="lifecycle-preview-title"><span className="lifecycle-preview-image" style={thumbStyle(item.model, 76, 12)} /><div><span className="lifecycle-preview-kicker">{item.category || item.type || "IT equipment"} · Lifecycle record</span><h2 id="lifecycle-preview-title">{item.name}</h2><p>{item.tag} · Serial {item.serial || "not recorded"}</p></div></div>
        <div className="lifecycle-preview-header-actions"><span className={`lifecycle-stage-badge lifecycle-stage-${life.tone}`}><i />{life.stage}</span><button type="button" className="lifecycle-preview-close" onClick={onClose} aria-label="Close lifecycle details"><IconX /></button></div>
      </header>
      <div className="lifecycle-preview-scroll">
        <section className="lifecycle-preview-life">
          <div className="lifecycle-preview-life-top"><div><span>Lifecycle completion</span><strong>{life.percent}%</strong></div><div><span>{life.remaining}</span><strong>{flags.replacement || "Replacement not configured"}</strong></div></div>
          <div className="lifecycle-life-track lifecycle-preview-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={life.percent}><span className="lifecycle-life-fill" style={{ width: `${life.percent}%` }} />{[25, 50, 75].map((marker) => <i key={marker} className={life.percent >= marker ? "reached" : ""} style={{ left: `${marker}%` }} />)}</div>
          <div className="lifecycle-preview-milestones"><span><i />Acquired<b>{item.purchased || "Not recorded"}</b></span><span><i />Active service<b>{item.status || "Not recorded"}</b></span><span><i />Lifecycle review<b>{life.percent >= 85 ? "Review now" : "Planned"}</b></span><span><i />Replacement<b>{flags.replacement || "Not configured"}</b></span></div>
        </section>
        <div className="lifecycle-preview-stat-grid">
          <div className="lifecycle-preview-stat value"><small>Current book value</small><strong>{money(bookValue)}</strong><span>{retained}% value retained</span></div>
          <div className="lifecycle-preview-stat cost"><small>Purchase cost</small><strong>{money(cost)}</strong><span>{money(depreciation)} depreciated</span></div>
          <div className="lifecycle-preview-stat warranty"><small>Warranty</small><strong>{item.warranty || "Not recorded"}</strong><span>{flags.warrantyExpired ? "Coverage expired" : flags.warrantySoon ? "Expires within 90 days" : item.warranty ? "Coverage recorded" : "Needs configuration"}</span></div>
          <div className="lifecycle-preview-stat condition"><small>Condition</small><strong>{item.condition || "Not recorded"}</strong><span>{item.status || "Status not recorded"}</span></div>
        </div>
        <div className="lifecycle-preview-columns">
          <section className="lifecycle-preview-section"><div className="lifecycle-preview-section-title"><span>Asset information</span><small>Identity and custody</small></div><div className="lifecycle-preview-info-grid">{[["Asset tag", item.tag], ["Serial number", item.serial], ["Equipment type", item.category || item.type], ["Model", item.model], ["Location", item.location], ["Room", item.room], ["Supplier", item.supplier], ["Current holder", item.borrower || "Not assigned"]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Not recorded"}</strong></div>)}</div></section>
          <section className="lifecycle-preview-section"><div className="lifecycle-preview-section-title"><span>Financial lifecycle</span><small>Depreciation controls</small></div><div className="lifecycle-preview-info-grid">{[["Purchase date", item.purchased], ["Useful life", `${item.usefulLifeYears || 5} years`], ["Depreciation method", item.depreciationMethod || "Straight-line"], ["Salvage value", money(item.salvageValue || 0)], ["Expected replacement", flags.replacement], ["Loan history", `${item.loanCount || 0} checkouts`]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Not recorded"}</strong></div>)}</div></section>
        </div>
        <section className="lifecycle-preview-section lifecycle-preview-history"><div className="lifecycle-preview-section-title"><span>Lifecycle workflow activity</span><small>{itemActions.length} related requests</small></div>{itemActions.length ? <div className="lifecycle-preview-events">{itemActions.map((action) => <div key={action.id}><span className={`lifecycle-event-dot lifecycle-event-${String(action.status).toLowerCase().replace(/\s+/g, "-")}`} /><div><strong>{action.type}</strong><p>{action.justification || "No justification recorded"}</p><small>{action.id} · {dateTime(action.requestedAt)} · {action.requestedBy}</small></div><StatusBadge status={action.status} /></div>)}</div> : <div className="lifecycle-preview-no-events">No transfer or disposition workflow has been recorded for this asset.</div>}</section>
      </div>
      <footer className="lifecycle-preview-footer"><span>Lifecycle values are calculated from the recorded purchase and replacement dates.</span><div><button type="button" className="lifecycle-preview-secondary" onClick={onClose}>Close</button>{canManage && <button type="button" className="lifecycle-preview-configure" onClick={() => onConfigure(item)}>Configure lifecycle</button>}<button type="button" className="lifecycle-preview-primary" onClick={() => onOpenFullRecord(item.id)}>Open full asset record</button></div></footer>
    </section>
  </div>;
}

async function readDocument(file) {
  if (file.size > 6 * 1024 * 1024)
    throw new Error("Each supporting document must be smaller than 6 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The document could not be read."));
    reader.readAsDataURL(file);
  });
  return {
    id: `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    data,
    addedAt: new Date().toISOString(),
  };
}

function ApprovalDocument({ action, item, onClose }) {
  const [busy, setBusy] = useState(false);
  const bookValue = bookValueFor({
    ...item,
    cost: action.purchaseCost ?? item?.cost,
    purchased: action.purchaseDate ?? item?.purchased,
  });

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      doc.setFillColor(10, 61, 124);
      doc.rect(0, 0, 210, 28, "F");
      const logo = await imageData("brand/msbm-lockup.png");
      doc.addImage(logo, "PNG", 10, 3, 55, 22);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ASSET LIFECYCLE APPROVAL", 196, 12, { align: "right" });
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.text(action.id, 196, 19, { align: "right" });
      doc.setTextColor(28, 41, 54);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`${action.type.toUpperCase()} REQUEST`, 14, 42);
      doc.setFontSize(11);
      doc.text(action.itemName, 14, 51);
      doc.setFont("courier", "normal");
      doc.setTextColor(10, 61, 124);
      doc.text(
        `${action.itemTag}  |  ${action.itemSerial || "Serial not recorded"}`,
        14,
        57,
      );
      const fields = [
        ["Status", action.status],
        ["Effective date", action.effectiveDate],
        ["Purchase cost", money(action.purchaseCost)],
        ["Estimated book value", money(bookValue)],
        [
          "Location of record",
          `${action.recordedLocation} · ${action.recordedRoom}`,
        ],
        [
          "Recipient / destination",
          action.recipient ||
            action.vendor ||
            `${action.destinationBuilding || ""} ${action.destinationRoom || ""}`.trim() ||
            "Not recorded",
        ],
      ];
      let y = 67;
      fields.forEach(([label, value], index) => {
        const x = index % 2 ? 108 : 14;
        if (index && index % 2 === 0) y += 18;
        doc.setFillColor(246, 248, 250);
        doc.roundedRect(x, y, 88, 14, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(108, 122, 136);
        doc.text(label.toUpperCase(), x + 4, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(38, 51, 64);
        doc.text(String(value || "Not recorded").slice(0, 44), x + 4, y + 11);
      });
      y += 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("BUSINESS JUSTIFICATION", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(67, 79, 91);
      doc.text(
        doc.splitTextToSize(action.justification || "Not recorded", 180),
        14,
        y + 7,
      );
      y += 35;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(38, 51, 64);
      doc.text("CONTROL DETAILS", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(
        doc.splitTextToSize(
          `Method/vendor: ${action.disposalMethod || action.vendor || "Not applicable"}\nIncident/reference: ${action.incidentReference || "Not recorded"}\nData sanitization: ${action.dataSanitization || "Not applicable"}\nSupporting documents: ${(action.documents || []).map((entry) => entry.name).join(", ") || "None attached"}`,
          180,
        ),
        14,
        y + 7,
      );
      doc.text(
        doc.splitTextToSize(
          `Approval note: ${action.approvalNote || "No decision note recorded"}`,
          180,
        ),
        14,
        y + 31,
      );
      y += 51;
      doc.setDrawColor(200, 209, 218);
      doc.roundedRect(14, y, 84, 32, 2, 2);
      doc.roundedRect(112, y, 84, 32, 2, 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(103, 117, 131);
      doc.text("REQUESTED BY", 19, y + 7);
      doc.text("ADMINISTRATOR APPROVAL", 117, y + 7);
      doc.setFontSize(10);
      doc.setTextColor(35, 48, 61);
      doc.text(action.requestedBy || "—", 19, y + 16);
      doc.text(action.decidedBy || "Pending approval", 117, y + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 123, 136);
      doc.text(dateTime(action.requestedAt), 19, y + 24);
      doc.text(
        action.decidedAt ? dateTime(action.decidedAt) : "No decision recorded",
        117,
        y + 24,
      );
      doc.setFontSize(7.5);
      doc.text(
        "MSBM IT Inventory System · Controlled asset lifecycle record",
        105,
        288,
        { align: "center" },
      );
      doc.save(`${action.type}-Approval-${action.itemTag}-${action.id}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={backdrop}>
      <div
        style={{
          width: "min(930px,100%)",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#fff",
          borderRadius: 12,
        }}
      >
        <div
          className="lifecycle-document-controls"
          style={{
            padding: "13px 16px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            borderBottom: "1px solid #e2e7ec",
          }}
        >
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 15 }}>
              Lifecycle approval document
            </strong>
            <small style={{ color: "#7b8794" }}>
              {action.id} · {action.status}
            </small>
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => window.print()}
            style={secondaryButton}
          >
            Print
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={downloadPdf}
            style={primaryButton}
          >
            {busy ? "Generating…" : "Download PDF"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            style={closeButton}
          >
            <IconX />
          </button>
        </div>
        <div style={{ padding: 22, overflow: "auto", background: "#e9eef3" }}>
          <article className="lifecycle-approval-sheet">
            <header>
              <img
                src="brand/msbm-lockup.png"
                alt="Mona School of Business & Management"
              />
              <span>
                <strong>ASSET LIFECYCLE APPROVAL</strong>
                <small>{action.id}</small>
              </span>
            </header>
            <h1>{action.type} request</h1>
            <p className="lifecycle-doc-subtitle">
              {action.itemName} · {action.itemTag} ·{" "}
              {action.itemSerial || "Serial not recorded"}
            </p>
            <div className="lifecycle-doc-grid">
              {[
                ["Status", action.status],
                ["Effective date", action.effectiveDate],
                ["Purchase cost", money(action.purchaseCost)],
                ["Estimated book value", money(bookValue)],
                [
                  "Recorded location",
                  `${action.recordedLocation} · ${action.recordedRoom}`,
                ],
                [
                  "Recipient / destination",
                  action.recipient ||
                    action.vendor ||
                    `${action.destinationBuilding || ""} ${action.destinationRoom || ""}`.trim() ||
                    "Not recorded",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value || "Not recorded"}</strong>
                </div>
              ))}
            </div>
            <section>
              <h2>Business justification</h2>
              <p>{action.justification}</p>
            </section>
            <section>
              <h2>Control details</h2>
              <p>
                Method/vendor:{" "}
                {action.disposalMethod || action.vendor || "Not applicable"}
                <br />
                Incident/reference: {action.incidentReference || "Not recorded"}
                <br />
                Data sanitization: {action.dataSanitization || "Not applicable"}
                <br />
                Supporting documents:{" "}
                {(action.documents || [])
                  .map((entry) => entry.name)
                  .join(", ") || "None attached"}
                <br />
                Approval note:{" "}
                {action.approvalNote || "No decision note recorded"}
              </p>
            </section>
            <div className="lifecycle-doc-signatures">
              <div>
                <small>Requested by</small>
                <strong>{action.requestedBy}</strong>
                <span>{dateTime(action.requestedAt)}</span>
              </div>
              <div>
                <small>Administrator approval</small>
                <strong>{action.decidedBy || "Pending approval"}</strong>
                <span>
                  {action.decidedAt
                    ? dateTime(action.decidedAt)
                    : "No decision recorded"}
                </span>
              </div>
            </div>
            <footer>
              MSBM IT Inventory System · Controlled asset lifecycle record
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

export default function Lifecycle({
  items,
  actions,
  query,
  canManage,
  canApprove,
  createSignal = 0,
  onCreateSignalHandled,
  focusItemId = "",
  focusSignal = 0,
  onUpdateAsset,
  onCreateAction,
  onDecide,
  onComplete,
  onOpenItem,
}) {
  const [tab, setTab] = useState("forecast");
  const [settingsItem, setSettingsItem] = useState(null);
  const [settings, setSettings] = useState({});
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(blankAction());
  const [requestError, setRequestError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [documentAction, setDocumentAction] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [forecastSort, setForecastSort] = useState({
    key: "replacement",
    direction: "asc",
  });
  const [forecastPage, setForecastPage] = useState(1);
  const [equipmentCategory, setEquipmentCategory] = useState("All categories");
  const [summaryFilter, setSummaryFilter] = useState("");
  const [actionSort, setActionSort] = useState({
    key: "requested",
    direction: "desc",
  });
  const documentInput = useRef(null);
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  useEffect(() => {
    if (!focusSignal || !focusItemId) return;
    const focusedItem = itemMap.get(focusItemId);
    if (!focusedItem) return;
    setTab("forecast");
    setPreviewItem(focusedItem);
  }, [focusItemId, focusSignal, itemMap]);
  const term = (query || "").trim().toLowerCase();
  const equipmentCategories = useMemo(
    () => {
      const available = new Set(
        items
          .filter((item) => item.status !== "Retired")
          .map(lifecycleCategoryFor),
      );
      return LIFECYCLE_CATEGORIES.filter((category) => available.has(category));
    },
    [items],
  );
  const scopedItems = useMemo(
    () => items.filter(
      (item) =>
        (equipmentCategory === "All categories" || lifecycleCategoryFor(item) === equipmentCategory) &&
        (!term || `${item.name} ${item.tag} ${item.serial} ${item.location} ${item.room}`.toLowerCase().includes(term)),
    ),
    [items, term, equipmentCategory],
  );
  const monitoredItems = useMemo(
    () => scopedItems.filter((item) => item.status !== "Retired"),
    [scopedItems],
  );
  const activeItems = useMemo(
    () =>
      sortRows(
        scopedItems.filter((item) => {
          if (summaryFilter === "retired") return item.status === "Retired";
          if (item.status === "Retired") return false;
          if (summaryFilter === "critical") return lifecycleFlags(item).replacementDue;
          if (summaryFilter === "warning") return lifecycleFlags(item).warrantySoon;
          return true;
        }),
        forecastSort,
        {
          asset: (row) => row.name,
          purchase: (row) => row.purchased,
          depreciation: (row) => row.depreciationMethod || "Straight-line",
          bookValue: (row) => bookValueFor(row),
          replacement: (row) => expectedReplacementFor(row),
        },
      ),
    [scopedItems, summaryFilter, forecastSort],
  );
  const forecastPageCount = Math.max(
    1,
    Math.ceil(activeItems.length / ASSETS_PER_PAGE),
  );
  const pagedActiveItems = useMemo(
    () =>
      activeItems.slice(
        (forecastPage - 1) * ASSETS_PER_PAGE,
        forecastPage * ASSETS_PER_PAGE,
      ),
    [activeItems, forecastPage],
  );
  const forecastPageNumbers = useMemo(() => {
    if (forecastPageCount <= 7) {
      return Array.from({ length: forecastPageCount }, (_, index) => index + 1);
    }
    const pages = new Set([
      1,
      forecastPageCount,
      forecastPage - 1,
      forecastPage,
      forecastPage + 1,
    ]);
    const ordered = [...pages]
      .filter((page) => page >= 1 && page <= forecastPageCount)
      .sort((a, b) => a - b);
    const result = [];
    ordered.forEach((page, index) => {
      if (index && page - ordered[index - 1] > 1) result.push("ellipsis-" + page);
      result.push(page);
    });
    return result;
  }, [forecastPage, forecastPageCount]);
  useEffect(() => setForecastPage(1), [term, equipmentCategory, summaryFilter, forecastSort.key, forecastSort.direction]);
  useEffect(
    () => setForecastPage((current) => Math.min(current, forecastPageCount)),
    [forecastPageCount],
  );
  const visibleActions = useMemo(
    () =>
      sortRows(
        actions.filter(
          (action) =>
            (summaryFilter !== "approval" || action.status === "Pending approval") &&
            (!term ||
              `${action.id} ${action.type} ${action.itemName} ${action.itemTag} ${action.status} ${action.recipient} ${action.vendor}`
                .toLowerCase()
                .includes(term)),
        ),
        actionSort,
        {
          request: (row) => row.itemName,
          workflow: (row) => row.type,
          justification: (row) => row.justification,
          requested: (row) => row.requestedAt,
          financial: (row) => Number(row.purchaseCost || 0),
          status: (row) => row.status,
        },
      ),
    [actions, term, summaryFilter, actionSort],
  );
  const due = monitoredItems.filter(
    (item) => lifecycleFlags(item).replacementDue,
  ).length;
  const warrantySoon = monitoredItems.filter(
    (item) => lifecycleFlags(item).warrantySoon,
  ).length;
  const pending = actions.filter(
    (action) => action.status === "Pending approval",
  ).length;
  const retired = scopedItems.filter((item) => item.status === "Retired").length;

  const selectSummary = (tone) => {
    const next = summaryFilter === tone ? "" : tone;
    setSummaryFilter(next);
    setTab(tone === "approval" ? "actions" : "forecast");
  };

  const openSettings = (item) => {
    setSettingsItem(item);
    setSettings({
      purchased: item.purchased || "",
      warranty: item.warranty || "",
      depreciationMethod: item.depreciationMethod || "Straight-line",
      usefulLifeYears: item.usefulLifeYears || 5,
      salvageValue: item.salvageValue || 0,
      expectedReplacementDate: expectedReplacementFor(item),
    });
  };
  const saveSettings = () => {
    onUpdateAsset(settingsItem.id, {
      ...settings,
      usefulLifeYears: Math.max(1, Number(settings.usefulLifeYears) || 5),
      salvageValue: Math.max(0, Number(settings.salvageValue) || 0),
    });
    setSettingsItem(null);
  };
  const openRequest = () => {
    setRequestForm(blankAction(activeItems[0]?.id || ""));
    setRequestError("");
    setRequestOpen(true);
  };
  useEffect(() => {
    if (createSignal && canManage) { openRequest(); onCreateSignalHandled?.(); }
  }, [createSignal]);
  const saveRequest = () => {
    if (!requestForm.itemId) {
      setRequestError("Choose an asset.");
      return;
    }
    if (!requestForm.justification.trim()) {
      setRequestError("Enter the business justification.");
      return;
    }
    if (
      requestForm.type === "Transfer" &&
      !requestForm.destinationBuilding.trim()
    ) {
      setRequestError("Enter the destination building.");
      return;
    }
    const saved = onCreateAction({
      ...requestForm,
      proceeds: Math.max(0, Number(requestForm.proceeds) || 0),
    });
    if (saved) setRequestOpen(false);
  };
  const addDocuments = async (event) => {
    const files = Array.from(event.target.files || []).slice(
      0,
      Math.max(0, 4 - requestForm.documents.length),
    );
    try {
      const documents = await Promise.all(files.map(readDocument));
      setRequestForm((current) => ({
        ...current,
        documents: [...current.documents, ...documents].slice(0, 4),
      }));
    } catch (error) {
      setRequestError(error.message);
    }
    event.target.value = "";
  };
  const decide = (decision) => {
    if (onDecide(selectedAction.id, decision, approvalNote)) {
      setSelectedAction(null);
      setApprovalNote("");
    }
  };

  return (
    <div className="lifecycle-workspace">
      <section className="lifecycle-hero">
        <div>
          <span className="lifecycle-eyebrow">Asset intelligence</span>
          <h2>Lifecycle portfolio</h2>
          <p>
            See the age, value, coverage, and replacement readiness of every
            asset at a glance.
          </p>
        </div>
        <div className="lifecycle-hero-orbit">
          <span>{monitoredItems.length}</span>
          <small>
            active assets
            <br />
            being monitored
          </small>
        </div>
      </section>
      <div className="lifecycle-summary-grid">
        {[
          [
            "Replacement overdue",
            due,
            "Beyond planned service life",
            "critical",
          ],
          [
            "Warranty review",
            warrantySoon,
            "Coverage ending within 90 days",
            "warning",
          ],
          [
            "Awaiting approval",
            pending,
            "Workflow decisions required",
            "approval",
          ],
          [
            "Retired records",
            retired,
            "Completed lifecycle records",
            "retired",
          ],
        ].map(([label, value, note, tone]) => (
          <button
            type="button"
            key={label}
            className={`lifecycle-summary-card lifecycle-summary-${tone}`}
            data-active={summaryFilter === tone}
            aria-pressed={summaryFilter === tone}
            onClick={() => selectSummary(tone)}
          >
            <span className="lifecycle-summary-icon" />
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{note}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="lifecycle-toolbar">
        <div className="lifecycle-tabs">
          <button
            type="button"
            className={tab === "forecast" ? "active" : ""}
            onClick={() => { setTab("forecast"); if (summaryFilter === "approval") setSummaryFilter(""); }}
          >
            Asset life map
          </button>
          <button
            type="button"
            className={tab === "actions" ? "active" : ""}
            onClick={() => { setTab("actions"); if (summaryFilter !== "approval") setSummaryFilter(""); }}
          >
            Disposition workflows
          </button>
        </div>
        <span className="lifecycle-result-count">
          {tab === "forecast"
            ? `${activeItems.length} ${summaryFilter === "retired" ? "retired records" : "assets"}`
            : `${visibleActions.length} lifecycle requests`}
        </span>
        {tab === "forecast" && (
          <label className="lifecycle-type-filter" htmlFor="lifecycle-equipment-category">
            <span>Category</span>
            <select id="lifecycle-equipment-category" value={equipmentCategory} onChange={(event) => setEquipmentCategory(event.target.value)}>
              <option>All categories</option>
              {equipmentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        )}
        {tab === "forecast" && (
          <div className="lifecycle-sort">
            <label htmlFor="lifecycle-sort">Sort by</label>
            <select
              id="lifecycle-sort"
              value={forecastSort.key}
              onChange={(event) =>
                setForecastSort((current) => ({
                  ...current,
                  key: event.target.value,
                }))
              }
            >
              <option value="replacement">Replacement date</option>
              <option value="asset">Asset name</option>
              <option value="purchase">Purchase date</option>
              <option value="bookValue">Book value</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setForecastSort((current) => ({
                  ...current,
                  direction: current.direction === "asc" ? "desc" : "asc",
                }))
              }
            >
              {forecastSort.direction === "asc"
                ? "Ascending ↑"
                : "Descending ↓"}
            </button>
          </div>
        )}
        {canManage && tab === "actions" && (
          <button
            type="button"
            className="btn-primary"
            onClick={openRequest}
            style={primaryButton}
          >
            + New lifecycle request
          </button>
        )}
      </div>
      {tab === "forecast" && (
        <div className="lifecycle-assets-list">
          {pagedActiveItems.map((item) => (
            <LifecycleAssetCard
              key={item.id}
              item={item}
              canManage={canManage}
              onConfigure={openSettings}
              onOpen={(itemId) => setPreviewItem(itemMap.get(itemId) || null)}
            />
          ))}
          {!activeItems.length && (
            <div className="lifecycle-empty">
              <strong>No assets match this view</strong>
              <span>Try changing the search or add lifecycle data to an active asset.</span>
            </div>
          )}
          {!!activeItems.length && (
            <nav className="lifecycle-pagination" aria-label="Asset lifecycle pages">
              <span className="lifecycle-page-summary">
                Showing {(forecastPage - 1) * ASSETS_PER_PAGE + 1}–{Math.min(forecastPage * ASSETS_PER_PAGE, activeItems.length)} of {activeItems.length} assets
              </span>
              <div className="lifecycle-page-buttons">
                <button type="button" disabled={forecastPage === 1} onClick={() => setForecastPage((page) => Math.max(1, page - 1))}>‹ Previous</button>
                {forecastPageNumbers.map((page) =>
                  typeof page === "string" ? (
                    <span key={page} className="lifecycle-page-ellipsis">…</span>
                  ) : (
                    <button type="button" key={page} className={page === forecastPage ? "active" : ""} aria-current={page === forecastPage ? "page" : undefined} onClick={() => setForecastPage(page)}>{page}</button>
                  ),
                )}
                <button type="button" disabled={forecastPage === forecastPageCount} onClick={() => setForecastPage((page) => Math.min(forecastPageCount, page + 1))}>Next ›</button>
              </div>
            </nav>
          )}
        </div>
      )}
      {tab === "forecast" ? (
        <div style={tableCard}>
          <div style={{ ...forecastGrid, ...tableHeader }}>
            {[
              ["asset", "Asset"],
              ["purchase", "Purchase / warranty"],
              ["depreciation", "Depreciation"],
              ["bookValue", "Book value"],
              ["replacement", "Expected replacement"],
            ].map(([column, label]) => (
              <SortableHeader
                key={column}
                column={column}
                label={label}
                sort={forecastSort}
                onSort={(key) =>
                  setForecastSort((current) => nextSort(current, key))
                }
              />
            ))}
            <span></span>
          </div>
          {false && activeItems.map((item) => {
            const flags = lifecycleFlags(item);
            return (
              <div
                key={item.id}
                style={{
                  ...forecastGrid,
                  alignItems: "center",
                  borderTop: "1px solid #edf0f3",
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpenItem(item.id)}
                  style={assetButton}
                >
                  <span style={thumbStyle(item.model, 30, 5)} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.tag} · {item.location} {item.room}
                    </small>
                  </span>
                </button>
                <span style={cellStyle}>
                  <strong>{item.purchased || "Not recorded"}</strong>
                  <small
                    style={{
                      color: flags.warrantyExpired
                        ? "#b3261e"
                        : flags.warrantySoon
                          ? "#b8710f"
                          : "#7b8794",
                    }}
                  >
                    Warranty: {item.warranty || "Not recorded"}
                  </small>
                </span>
                <span style={cellStyle}>
                  <strong>{item.depreciationMethod || "Straight-line"}</strong>
                  <small>
                    {item.usefulLifeYears || 5} years · salvage{" "}
                    {money(item.salvageValue || 0)}
                  </small>
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {money(bookValueFor(item))}
                </span>
                <span style={cellStyle}>
                  <strong
                    style={{
                      color: flags.replacementDue
                        ? "#b3261e"
                        : flags.replacementSoon
                          ? "#b8710f"
                          : "#33414e",
                    }}
                  >
                    {flags.replacement || "Not configured"}
                  </strong>
                  <small>
                    {flags.replacementDue
                      ? "Replacement overdue"
                      : flags.replacementSoon
                        ? "Due within 90 days"
                        : "Within planned lifecycle"}
                  </small>
                </span>
                <span>
                  {canManage && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => openSettings(item)}
                      style={smallButton}
                    >
                      Configure
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={tableCard}>
          <div style={{ ...actionGrid, ...tableHeader }}>
            {[
              ["request", "Request / asset"],
              ["workflow", "Workflow"],
              ["justification", "Justification"],
              ["requested", "Requested"],
              ["financial", "Financial"],
              ["status", "Status"],
            ].map(([column, label]) => (
              <SortableHeader
                key={column}
                column={column}
                label={label}
                sort={actionSort}
                onSort={(key) =>
                  setActionSort((current) => nextSort(current, key))
                }
              />
            ))}
          </div>
          {visibleActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setSelectedAction(action);
                setApprovalNote(action.approvalNote || "");
              }}
              style={{
                ...actionGrid,
                width: "100%",
                alignItems: "center",
                background: "#fff",
                border: 0,
                borderTop: "1px solid #edf0f3",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span>
                <strong style={{ display: "block", fontSize: 12 }}>
                  {action.itemName}
                </strong>
                <small
                  style={{
                    color: "#0b4a94",
                    fontFamily: "'IBM Plex Mono',monospace",
                  }}
                >
                  {action.id} · {action.itemTag}
                </small>
              </span>
              <span style={{ fontSize: 12, fontWeight: 650 }}>
                {action.type}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#566472",
                  fontSize: 11.5,
                }}
              >
                {action.justification}
              </span>
              <span style={cellStyle}>
                <strong>{action.requestedBy}</strong>
                <small>{dateTime(action.requestedAt)}</small>
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 11,
                }}
              >
                {money(action.purchaseCost)}
              </span>
              <span>
                <StatusBadge status={action.status} />
              </span>
            </button>
          ))}
          {!visibleActions.length && (
            <div style={emptyStyle}>
              No lifecycle workflow requests have been created.
            </div>
          )}
        </div>
      )}

      {previewItem && (
        <LifecycleAssetModal
          item={previewItem}
          actions={actions}
          canManage={canManage}
          onClose={() => setPreviewItem(null)}
          onConfigure={(item) => {
            setPreviewItem(null);
            openSettings(item);
          }}
          onOpenFullRecord={(itemId) => {
            setPreviewItem(null);
            onOpenItem(itemId);
          }}
        />
      )}

      {settingsItem && (
        <div style={backdrop}>
          <div style={{ ...modalCard, width: "min(650px,100%)" }}>
            <ModalHeader
              title={`Lifecycle settings · ${settingsItem.name}`}
              subtitle={settingsItem.tag}
              onClose={() => setSettingsItem(null)}
            />
            <div style={formBody}>
              <div style={twoCols}>
                <Field label="Purchase date">
                  <input
                    type="date"
                    value={settings.purchased}
                    onChange={change(setSettings, "purchased")}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Warranty until">
                  <input
                    type="date"
                    value={settings.warranty}
                    onChange={change(setSettings, "warranty")}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={twoCols}>
                <Field label="Depreciation method">
                  <select
                    value={settings.depreciationMethod}
                    onChange={change(setSettings, "depreciationMethod")}
                    style={inputStyle}
                  >
                    <option>Straight-line</option>
                    <option>None</option>
                  </select>
                </Field>
                <Field label="Useful life (years)">
                  <input
                    type="number"
                    min="1"
                    value={settings.usefulLifeYears}
                    onChange={change(setSettings, "usefulLifeYears")}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={twoCols}>
                <Field label="Salvage value">
                  <input
                    type="number"
                    min="0"
                    value={settings.salvageValue}
                    onChange={change(setSettings, "salvageValue")}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Expected replacement date">
                  <input
                    type="date"
                    value={settings.expectedReplacementDate}
                    onChange={change(setSettings, "expectedReplacementDate")}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div
                style={{
                  padding: 11,
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#eef4fb",
                  borderRadius: 8,
                  color: "#0a3d7c",
                  fontSize: 12,
                }}
              >
                <span>Current estimated book value</span>
                <strong>
                  {money(bookValueFor({ ...settingsItem, ...settings }))}
                </strong>
              </div>
            </div>
            <ModalFooter
              onCancel={() => setSettingsItem(null)}
              onSave={saveSettings}
              saveLabel="Save lifecycle settings"
            />
          </div>
        </div>
      )}

      {requestOpen && (
        <div style={backdrop}>
          <div style={{ ...modalCard, width: "min(780px,100%)" }}>
            <ModalHeader
              title="New asset lifecycle request"
              subtitle="Submit a controlled transfer or disposition for administrator approval"
              onClose={() => setRequestOpen(false)}
            />
            <div style={{ ...formBody, overflowY: "auto" }}>
              <div style={twoCols}>
                <Field label="Asset">
                  <select
                    value={requestForm.itemId}
                    onChange={change(setRequestForm, "itemId")}
                    style={inputStyle}
                  >
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.tag} · {item.location} {item.room}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Workflow type">
                  <select
                    value={requestForm.type}
                    onChange={change(setRequestForm, "type")}
                    style={inputStyle}
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Business justification">
                <textarea
                  rows="4"
                  value={requestForm.justification}
                  onChange={change(setRequestForm, "justification")}
                  style={textareaStyle}
                />
              </Field>
              <div style={twoCols}>
                <Field label="Proposed effective date">
                  <input
                    type="date"
                    value={requestForm.effectiveDate}
                    onChange={change(setRequestForm, "effectiveDate")}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Recipient / receiving organization">
                  <input
                    value={requestForm.recipient}
                    onChange={change(setRequestForm, "recipient")}
                    style={inputStyle}
                  />
                </Field>
              </div>
              {requestForm.type === "Transfer" ? (
                <div style={twoCols}>
                  <Field label="Destination location">
                    <select
                      value={requestForm.destinationBuilding}
                      onChange={change(setRequestForm, "destinationBuilding")}
                      style={inputStyle}
                    >
                      <option value="">Choose a location…</option>
                      {BUILDINGS.map((location) => (
                        <option key={location}>{location}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Destination room">
                    <input
                      value={requestForm.destinationRoom}
                      onChange={change(setRequestForm, "destinationRoom")}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              ) : (
                <>
                  <div style={twoCols}>
                    <Field label="Disposal vendor / receiving party">
                      <input
                        value={requestForm.vendor}
                        onChange={change(setRequestForm, "vendor")}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Method">
                      <input
                        value={requestForm.disposalMethod}
                        onChange={change(setRequestForm, "disposalMethod")}
                        placeholder="Recycle, auction, destruction…"
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <div style={twoCols}>
                    <Field label="Incident / authorization reference">
                      <input
                        value={requestForm.incidentReference}
                        onChange={change(setRequestForm, "incidentReference")}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Proceeds / recovery value">
                      <input
                        type="number"
                        min="0"
                        value={requestForm.proceeds}
                        onChange={change(setRequestForm, "proceeds")}
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <Field label="Data sanitization / custody controls">
                    <textarea
                      rows="2"
                      value={requestForm.dataSanitization}
                      onChange={change(setRequestForm, "dataSanitization")}
                      style={textareaStyle}
                    />
                  </Field>
                </>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ flex: 1, fontSize: 11.5 }}>
                  Supporting approval documents ({requestForm.documents.length}
                  /4)
                </strong>
                <input
                  ref={documentInput}
                  hidden
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={addDocuments}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={requestForm.documents.length >= 4}
                  onClick={() => documentInput.current?.click()}
                  style={smallButton}
                >
                  + Attach documents
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {requestForm.documents.map((document) => (
                  <span
                    key={document.id}
                    style={{
                      padding: "6px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      background: "#f4f6f8",
                      borderRadius: 7,
                      fontSize: 10.5,
                    }}
                  >
                    {document.name}
                    <button
                      type="button"
                      onClick={() =>
                        setRequestForm((current) => ({
                          ...current,
                          documents: current.documents.filter(
                            (entry) => entry.id !== document.id,
                          ),
                        }))
                      }
                      style={{
                        border: 0,
                        background: "none",
                        color: "#a01a12",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {requestError && <div style={errorStyle}>{requestError}</div>}
            </div>
            <ModalFooter
              onCancel={() => setRequestOpen(false)}
              onSave={saveRequest}
              saveLabel="Submit for approval"
            />
          </div>
        </div>
      )}

      {selectedAction && (
        <div style={backdrop}>
          <div style={{ ...modalCard, width: "min(760px,100%)" }}>
            <ModalHeader
              title={`${selectedAction.type} request · ${selectedAction.id}`}
              subtitle={`${selectedAction.itemName} · ${selectedAction.itemTag}`}
              onClose={() => setSelectedAction(null)}
            />
            <div style={{ ...formBody, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <StatusBadge status={selectedAction.status} />
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                  }}
                >
                  Book value:{" "}
                  {money(
                    bookValueFor({
                      ...(itemMap.get(selectedAction.itemId) || {}),
                      cost: selectedAction.purchaseCost,
                      purchased: selectedAction.purchaseDate,
                    }),
                  )}
                </span>
              </div>
              <div style={detailGrid}>
                {[
                  ["Requested by", selectedAction.requestedBy],
                  ["Requested", dateTime(selectedAction.requestedAt)],
                  ["Effective date", selectedAction.effectiveDate],
                  [
                    "Recorded location",
                    `${selectedAction.recordedLocation} · ${selectedAction.recordedRoom}`,
                  ],
                  ["Recipient", selectedAction.recipient || "Not recorded"],
                  [
                    "Vendor / method",
                    selectedAction.vendor ||
                      selectedAction.disposalMethod ||
                      "Not applicable",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "9px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      background: "#fff",
                    }}
                  >
                    <small
                      style={{
                        color: "#74818e",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </small>
                    <strong style={{ color: "#33414e", fontSize: 11.5 }}>
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
              <Field label="Business justification">
                <div style={readOnlyBox}>{selectedAction.justification}</div>
              </Field>
              <Field label="Administrator decision note">
                <textarea
                  disabled={
                    !canApprove || selectedAction.status !== "Pending approval"
                  }
                  rows="3"
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  style={textareaStyle}
                />
              </Field>
              {(selectedAction.documents || []).length > 0 && (
                <Field label="Supporting documents">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {selectedAction.documents.map((document) => (
                      <a
                        key={document.id}
                        href={document.data}
                        download={document.name}
                        style={{
                          padding: "6px 8px",
                          background: "#eef4fb",
                          borderRadius: 7,
                          color: "#0a3d7c",
                          fontSize: 10.5,
                          textDecoration: "none",
                        }}
                      >
                        {document.name}
                      </a>
                    ))}
                  </div>
                </Field>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 11.5 }}>Activity</strong>
                {(selectedAction.activity || [])
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <div
                      key={`${entry.at}-${index}`}
                      style={{
                        padding: "7px 0",
                        display: "grid",
                        gridTemplateColumns: "145px 130px 1fr",
                        borderTop: "1px solid #edf0f3",
                        fontSize: 10.5,
                      }}
                    >
                      <span>{dateTime(entry.at)}</span>
                      <strong>{entry.by}</strong>
                      <span>{entry.text}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div style={modalFooter}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDocumentAction(selectedAction)}
                style={secondaryButton}
              >
                Approval document
              </button>
              <span style={{ flex: 1 }} />
              {canApprove && selectedAction.status === "Pending approval" && (
                <>
                  <button
                    type="button"
                    className="btn-ghost-danger"
                    onClick={() => decide("Rejected")}
                    style={secondaryButton}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => decide("Approved")}
                    style={primaryButton}
                  >
                    Approve
                  </button>
                </>
              )}
              {canApprove && selectedAction.status === "Approved" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (onComplete(selectedAction.id)) setSelectedAction(null);
                  }}
                  style={{ ...primaryButton, background: "#1c7c54" }}
                >
                  Complete workflow
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {documentAction && (
        <ApprovalDocument
          action={documentAction}
          item={itemMap.get(documentAction.itemId)}
          onClose={() => setDocumentAction(null)}
        />
      )}
    </div>
  );
}

function imageData(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = src;
  });
}
function Field({ label, children }) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div style={modalHeader}>
      <span style={{ flex: 1 }}>
        <strong style={{ display: "block", fontSize: 15 }}>{title}</strong>
        <small style={{ color: "#7b8794" }}>{subtitle}</small>
      </span>
      <button
        type="button"
        className="btn-ghost"
        onClick={onClose}
        style={closeButton}
      >
        <IconX />
      </button>
    </div>
  );
}
function ModalFooter({ onCancel, onSave, saveLabel }) {
  return (
    <div style={modalFooter}>
      <button
        type="button"
        className="btn-ghost"
        onClick={onCancel}
        style={secondaryButton}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn-primary"
        onClick={onSave}
        style={primaryButton}
      >
        {saveLabel}
      </button>
    </div>
  );
}
const change = (setter, key) => (event) =>
  setter((current) => ({ ...current, [key]: event.target.value }));
const tabStyle = (active) => ({
  height: 35,
  padding: "0 13px",
  border: 0,
  background: active ? "#0a3d7c" : "#fff",
  color: active ? "#fff" : "#5c6874",
  fontSize: 12,
  fontWeight: 650,
  cursor: "pointer",
});
const primaryButton = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 650,
};
const secondaryButton = {
  height: 36,
  padding: "0 13px",
  borderRadius: 8,
  fontSize: 12,
};
const smallButton = {
  height: 30,
  padding: "0 9px",
  borderRadius: 7,
  fontSize: 10.5,
};
const closeButton = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
};
const tableCard = {
  background: "#fff",
  border: "1px solid #dfe3e9",
  borderRadius: 10,
  overflow: "hidden",
};
const tableHeader = {
  background: "#f6f8fa",
  color: "#74818e",
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".07em",
};
const forecastGrid = {
  padding: "11px 14px",
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1fr .7fr 1fr .55fr",
  gap: 12,
};
const actionGrid = {
  padding: "11px 14px",
  display: "grid",
  gridTemplateColumns: "1.3fr .6fr 1.4fr .85fr .6fr .7fr",
  gap: 12,
};
const assetButton = {
  minWidth: 0,
  padding: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
  background: "none",
  border: 0,
  textAlign: "left",
  cursor: "pointer",
};
const cellStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
  color: "#4f5d69",
  fontSize: 11.5,
};
const emptyStyle = {
  padding: 42,
  textAlign: "center",
  color: "#7b8794",
  fontSize: 12.5,
};
const backdrop = {
  position: "fixed",
  inset: 0,
  zIndex: 74,
  padding: 24,
  display: "grid",
  placeItems: "center",
  background: "rgba(13,17,22,.55)",
};
const modalCard = {
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 24px 70px rgba(13,17,22,.25)",
};
const modalHeader = {
  padding: "14px 17px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid #e5e9ed",
};
const modalFooter = {
  padding: "13px 17px",
  display: "flex",
  alignItems: "center",
  gap: 9,
  borderTop: "1px solid #e5e9ed",
};
const formBody = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 13,
};
const labelStyle = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#62707d",
  fontSize: 10.5,
  fontWeight: 650,
};
const inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  height: 36,
  padding: "0 9px",
  background: "#fff",
  border: "1px solid #cbd5df",
  borderRadius: 8,
  color: "#263746",
  fontSize: 11.5,
};
const textareaStyle = {
  ...inputStyle,
  height: "auto",
  padding: 9,
  resize: "vertical",
  fontFamily: "inherit",
};
const twoCols = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const detailGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1,
  overflow: "hidden",
  background: "#e2e7ec",
  border: "1px solid #e2e7ec",
  borderRadius: 8,
};
const readOnlyBox = {
  minHeight: 45,
  padding: 10,
  background: "#f6f8fa",
  borderRadius: 7,
  color: "#3e4b57",
  fontSize: 11.5,
  lineHeight: 1.5,
};
const errorStyle = {
  padding: "8px 10px",
  background: "#fdeceb",
  border: "1px solid #f3cbc8",
  borderRadius: 7,
  color: "#a01a12",
  fontSize: 11.5,
};
