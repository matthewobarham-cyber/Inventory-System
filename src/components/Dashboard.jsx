import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDINGS,
  glbUrl,
  iso,
  isLowStock,
  longDate,
  money,
  today,
} from "../data.js";
import StocktakeFlag from './StocktakeFlag.jsx';

const LEVELS = {
  Critical: { color: "#b3261e", background: "#fdeceb", border: "#f4cdc9" },
  Action: { color: "#8a5209", background: "#fdf0e0", border: "#f1d5ad" },
  Update: { color: "#18704f", background: "#e8f5ee", border: "#c8e3d4" },
};

let persistedCarouselIndex = 0;

function circularOffset(index, active, total) {
  if (!total) return 0;
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function Dashboard({
  items,
  requests,
  orders,
  placements,
  history,
  availableScreens,
  onOpenItem,
  onGoInventory,
  onOpenSummary,
  onOpenNotification,
  isActive = true,
}) {
  const [noticeFilter, setNoticeFilter] = useState("All");
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const notificationCarouselRef = useRef(null);
  const [carouselIndex, setCarouselIndex] = useState(
    () => persistedCarouselIndex,
  );
  const [carouselActive, setCarouselActive] = useState(
    () => document.visibilityState === "visible" && document.hasFocus(),
  );
  const [carouselDragging, setCarouselDragging] = useState(false);
  const [carouselDragOffset, setCarouselDragOffset] = useState(0);
  const [carouselHoverDirection, setCarouselHoverDirection] = useState(0);
  const dragState = useRef({ startX: 0, moved: false, pointerId: null });
  const suppressCarouselClick = useRef(false);
  const todayIso = iso(today());
  const onLoan = useMemo(
    () => items.filter((item) => item.status === "On loan"),
    [items],
  );
  const overdue = useMemo(
    () => onLoan.filter((item) => item.due && item.due < todayIso),
    [onLoan, todayIso],
  );
  const low = useMemo(() => items.filter(isLowStock), [items]);
  const maintenance = useMemo(
    () => items.filter((item) => item.status === "Maintenance"),
    [items],
  );
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.state === "Pending"),
    [requests],
  );
  const pendingOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["Pending", "Partially received"].includes(order.status),
      ),
    [orders],
  );
  const pendingPlacements = useMemo(
    () => placements.filter((placement) => placement.status === "Pending"),
    [placements],
  );
  const totalValue = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.cost * Math.max(1, item.qty), 0),
    [items],
  );

  const notifications = useMemo(() => {
    const result = [];

    items.filter((item) => item.stocktakeState === 'Missing').forEach((item) =>
      result.push({
        id: `stocktake-missing-${item.id}-${item.stocktakeSessionId || ''}`,
        level: 'Critical',
        source: 'Stocktake',
        title: `${item.name} was not found`,
        detail: `${item.tag} · missing from ${item.stocktakeSessionTitle || 'physical verification'}`,
        meta: item.stocktakeNote || `Recorded at ${item.location} ${item.room}`,
        target: 'item',
        itemId: item.id,
        actionLabel: 'Investigate missing asset'
      })
    );

    overdue.forEach((item) =>
      result.push({
        id: `overdue-${item.id}`,
        level: "Critical",
        source: "Loans",
        title: `${item.name} is overdue`,
        detail: `${item.tag} · checked out to ${item.borrower} · due ${longDate(item.due)}`,
        meta: item.location,
        target: "item",
        itemId: item.id,
        actionLabel: "Open loaned asset",
      }),
    );

    low.forEach((item) =>
      result.push({
        id: `stock-${item.id}`,
        level: item.qty === 0 ? "Critical" : "Action",
        source: "Low stock",
        title:
          item.qty === 0
            ? `${item.name} is out of stock`
            : `${item.name} is below minimum`,
        detail: `${item.qty} on hand · minimum ${item.min} · ${item.location} ${item.room}`,
        meta: item.supplier,
        target: "alerts",
        itemId: item.id,
        searchTerm: item.tag,
        actionLabel: item.qty === 0 ? "Reorder stock" : "Review low stock",
      }),
    );

    maintenance.forEach((item) =>
      result.push({
        id: `maintenance-${item.id}`,
        level: "Action",
        source: "Maintenance",
        title: `${item.name} requires maintenance`,
        detail: `${item.tag} · condition: ${item.condition} · ${item.location} ${item.room}`,
        meta: "Open maintenance workspace",
        target: "maintenance",
        itemId: item.id,
        searchTerm: item.tag,
        actionLabel: "Open maintenance",
      }),
    );

    items
      .filter((item) => item.receiptSource === "manual" && item.receivedOn)
      .slice(0, 8)
      .forEach((item) =>
        result.push({
          id: `received-${item.id}-${item.receivedOn}`,
          level: "Update",
          source: "Inventory receipt",
          title: `${item.name} stock was added`,
          detail: `Received ${longDate(item.receivedOn)} from ${item.receivedCompany || item.supplier} by ${item.receivedBy} · ${item.invoiceGenerated ? `invoice ${item.invoiceNumber}` : "invoice needs to be generated"}`,
          meta: `${item.qty} now recorded at ${item.location} ${item.room}`,
          target: "item",
          itemId: item.id,
          actionLabel: item.invoiceGenerated ? "Open received asset" : "Generate asset invoice",
        }),
      );

    if (availableScreens.includes("requests")) {
      pendingRequests.forEach((request) =>
        result.push({
          id: `request-${request.id}`,
          level: "Action",
          source: "Requests",
          title: `${request.by} requested ${request.itemName}`,
          detail: request.need,
          meta:
            request.type === "Requisition"
              ? "Reorder requisition awaiting admin / manager approval"
              : request.when,
          target: "requests",
          requestId: request.id,
          actionLabel: "Review request",
        }),
      );
    }

    if (availableScreens.includes("orders")) {
      pendingOrders.forEach((order) => {
        const late = order.expectedOn && order.expectedOn < todayIso;
        result.push({
          id: `order-${order.id}`,
          level: late ? "Critical" : "Action",
          source: "Pending orders",
          title: late
            ? `${order.name} delivery is overdue`
            : `${order.name} order is awaiting delivery`,
          detail: `${order.qty} ordered from ${order.supplier} · expected ${longDate(order.expectedOn)}`,
          meta: order.purchaseOrderNumber
            ? `PO ${order.purchaseOrderNumber}`
            : order.requisitionNumber ||
              order.reference ||
              "No requisition number",
          target: "orders",
          itemId: order.itemId,
          orderId: order.id,
          searchTerm: order.requisitionNumber || order.purchaseOrderNumber || order.name,
          actionLabel: late ? "Review overdue order" : "Open pending order",
        });
      });
    }

    if (availableScreens.includes("placements")) {
      pendingPlacements.forEach((placement) =>
        result.push({
          id: `placement-${placement.id}`,
          level: "Action",
          source: "Assignment",
          title: `${placement.remainingQty} ${placement.name}${placement.remainingQty === 1 ? "" : "s"} need setup`,
          detail: `Received ${longDate(placement.receivedOn)} from ${placement.supplier} by ${placement.receivedBy} · ${placement.invoiceGenerated ? `invoice ${placement.invoiceNumber}` : "invoice needs to be generated"}`,
          meta: placement.invoiceGenerated
            ? "Invoice recorded"
            : "Open to generate invoice",
          target: "placements",
          itemId: placement.itemId,
          placementId: placement.id,
          searchTerm: placement.reference || placement.name,
          actionLabel: "Set up asset",
        }),
      );
    }

    history
      .slice()
      .sort((a, b) => (b.back || "").localeCompare(a.back || ""))
      .slice(0, 5)
      .forEach((entry) =>
        result.push({
          id: `return-${entry.id}`,
          level: "Update",
          source: "Loan history",
          title: `${entry.name} was checked in`,
          detail: `${entry.tag} · returned by ${entry.borrower} · ${entry.condition}`,
          meta: longDate(entry.back),
          target: "item",
          itemId: entry.itemId,
          actionLabel: "Open returned asset",
        }),
      );

    const rank = { Critical: 0, Action: 1, Update: 2 };
    return result.sort((a, b) => rank[a.level] - rank[b.level]);
  }, [
    availableScreens,
    history,
    items,
    low,
    maintenance,
    overdue,
    pendingOrders,
    pendingPlacements,
    pendingRequests,
    todayIso,
  ]);

  const visibleNotifications =
    noticeFilter === "All"
      ? notifications
      : notifications.filter((notice) => notice.level === noticeFilter);
  const criticalCount = notifications.filter(
    (notice) => notice.level === "Critical",
  ).length;
  const actionCount = notifications.filter(
    (notice) => notice.level === "Action",
  ).length;
  const intakeUnits = pendingPlacements.reduce(
    (sum, placement) => sum + placement.remainingQty,
    0,
  );

  const priorityAssets = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const used = new Set();
    return notifications.reduce((selected, notice) => {
      const item = itemMap.get(notice.itemId);
      if (!item || used.has(item.id)) return selected;
      used.add(item.id);
      selected.push({ item, notice });
      return selected;
    }, []);
  }, [items, notifications]);
  const moveCarousel = (direction) => {
    if (!priorityAssets.length) return;
    setCarouselIndex((current) => {
      const next =
        (current + direction + priorityAssets.length) % priorityAssets.length;
      persistedCarouselIndex = next;
      return next;
    });
  };
  // Kept empty while the legacy flat strip remains in markup for compatibility;
  // the interactive circular deck below is the only carousel that renders cards.
  const carouselAssets = [];

  useEffect(() => {
    if (!priorityAssets.length) return;
    const next = Math.min(persistedCarouselIndex, priorityAssets.length - 1);
    persistedCarouselIndex = next;
    setCarouselIndex(next);
  }, [priorityAssets.length]);

  useEffect(() => {
    const updateActivity = () => {
      const active = isActive && document.visibilityState === "visible" && document.hasFocus();
      setCarouselActive(active);
      if (!active) {
        setCarouselHoverDirection(0);
      }
    };
    document.addEventListener("visibilitychange", updateActivity);
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", updateActivity);
    updateActivity();
    return () => {
      document.removeEventListener("visibilitychange", updateActivity);
      window.removeEventListener("focus", updateActivity);
      window.removeEventListener("blur", updateActivity);
    };
  }, [isActive]);

  useEffect(() => {
    if (!notificationCenterOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setNotificationCenterOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notificationCenterOpen]);

  useEffect(() => {
    if (!isActive || !carouselActive || carouselDragging || carouselHoverDirection || priorityAssets.length <= 1)
      return undefined;
    const timer = setInterval(() => moveCarousel(1), 4500);
    return () => clearInterval(timer);
  }, [isActive, carouselActive, carouselDragging, Boolean(carouselHoverDirection), priorityAssets.length]);

  useEffect(() => {
    if (!isActive || !carouselActive || carouselDragging || !carouselHoverDirection || priorityAssets.length <= 1) return undefined;
    const direction = carouselHoverDirection < 0 ? -1 : 1;
    const strength = Math.abs(carouselHoverDirection);
    const delay = Math.round(950 - strength * 570);
    const firstMove = setTimeout(() => moveCarousel(direction), Math.min(220, delay));
    const timer = setInterval(() => moveCarousel(direction), delay);
    return () => { clearTimeout(firstMove); clearInterval(timer); };
  }, [isActive, carouselActive, carouselDragging, carouselHoverDirection, priorityAssets.length]);

  const beginCarouselDrag = (event) => {
    if (priorityAssets.length <= 1 || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragState.current = { startX: event.clientX, moved: false, pointerId: event.pointerId };
    setCarouselDragging(true);
    setCarouselHoverDirection(0);
    setCarouselDragOffset(0);
  };
  const updateCarouselDrag = (event) => {
    if (dragState.current.pointerId === null) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      const axis = Math.max(-1, Math.min(1, (position - 0.5) * 2));
      const deadZone = 0.25;
      const strength = Math.abs(axis) <= deadZone ? 0 : Math.pow((Math.abs(axis) - deadZone) / (1 - deadZone), 0.75);
      const velocity = strength ? Math.sign(axis) * strength : 0;
      setCarouselHoverDirection((current) => Math.abs(current - velocity) < 0.04 ? current : velocity);
      return;
    }
    const offset = event.clientX - dragState.current.startX;
    if (Math.abs(offset) > 6 && !dragState.current.moved) {
      dragState.current.moved = true;
      setCarouselDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (!dragState.current.moved) return;
    setCarouselDragOffset(Math.max(-150, Math.min(150, offset)));
  };
  const endCarouselDrag = (event) => {
    if (dragState.current.pointerId === null) return;
    const offset = event.clientX - dragState.current.startX;
    if (dragState.current.moved) {
      if (Math.abs(offset) > 45) moveCarousel(offset < 0 ? 1 : -1);
      suppressCarouselClick.current = true;
      setTimeout(() => {
        suppressCarouselClick.current = false;
      }, 0);
    }
    dragState.current = { startX: 0, moved: false, pointerId: null };
    setCarouselDragging(false);
    setCarouselDragOffset(0);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const stats = [
    {
      label: "Urgent notifications",
      value: String(criticalCount),
      note: `${actionCount} additional actions`,
      tone: "critical",
      icon: "!",
      notificationCenter: true,
    },
    {
      label: "Out on loan",
      value: String(onLoan.length),
      note: `${overdue.length} past due`,
      tone: "blue",
      icon: "↗",
      action: "loans",
    },
    availableScreens.includes("requests")
      ? {
          label: "Pending requests",
          value: String(pendingRequests.length),
          note: "Awaiting a decision",
          tone: "amber",
          icon: "◇",
          action: "requests",
        }
      : {
          label: "Pending orders",
          value: String(pendingOrders.length),
          note: "Awaiting delivery",
          tone: "amber",
          icon: "◇",
          action: "orders",
        },
    {
      label: "Awaiting assignment",
      value: String(intakeUnits),
      note: `${pendingPlacements.length} received deliveries`,
      tone: "green",
      icon: "↓",
      action: "placements",
    },
  ];

  const buildingCounts = BUILDINGS.map((building) => ({
    name: building,
    count: items.filter((item) => item.location === building).length,
  }));
  const maxBuilding = Math.max(
    1,
    ...buildingCounts.map((building) => building.count),
  );
  const queueRows = [
    {
      label: "Overdue loans",
      value: overdue.length,
      target: "loans",
      color: overdue.length ? "#b3261e" : "#1c7c54",
    },
    {
      label: "Low-stock items",
      value: low.length,
      target: "alerts",
      color: low.length ? "#b3261e" : "#1c7c54",
    },
    {
      label: "Maintenance assets",
      value: maintenance.length,
      target: "inventory",
      color: maintenance.length ? "#b8710f" : "#1c7c54",
    },
    {
      label: "Pending requests",
      value: pendingRequests.length,
      target: "requests",
      color: "#b8710f",
    },
    {
      label: "Orders in transit",
      value: pendingOrders.length,
      target: "orders",
      color: "#0a3d7c",
    },
    {
      label: "Units awaiting setup",
      value: intakeUnits,
      target: "placements",
      color: "#0a3d7c",
    },
  ].filter((row) => availableScreens.includes(row.target));

  return (
    <div className="dashboard-workspace">
      <header className="dashboard-overview-heading">
        <span>
          <small>Operations overview</small>
          <strong>IT inventory command centre</strong>
          <p>{longDate(todayIso)} · Live asset, service and supply position</p>
        </span>
        <div>
          <span className={criticalCount ? "attention" : "clear"}><i />{criticalCount ? `${criticalCount} urgent` : 'No urgent risks'}</span>
          <span><i />{items.length} managed assets</span>
          <button type="button" onClick={() => setNotificationCenterOpen(true)}>Open notification centre <b>&rarr;</b></button>
        </div>
      </header>
      <section className="dashboard-kpis">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            data-tone={stat.tone}
            onClick={() => {
              if (stat.notificationCenter) {
                setNoticeFilter("Critical");
                setNotificationCenterOpen(true);
                return;
              }
              if (stat.filter) setNoticeFilter(stat.filter);
              else onOpenSummary(stat.action);
            }}
          >
            <span className="dashboard-kpi-icon">{stat.icon}</span>
            <span className="dashboard-kpi-label">{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
            <i>View details →</i>
          </button>
        ))}
      </section>

      <section className="dashboard-watch dashboard-watch-deck">
        <div className="dashboard-section-heading">
          <span>
            <small>Priority watchlist</small>
            <strong>Assets requiring attention</strong>
            <p>
              {priorityAssets.length} notification-linked asset
              {priorityAssets.length === 1 ? "" : "s"} · drag the deck or let it
              rotate
            </p>
          </span>
          <div className="dashboard-deck-heading-actions">
            <span className={carouselActive ? "playing" : "paused"}>
              {carouselActive ? "Auto rotating" : "Paused while away"}
            </span>
            <button type="button" onClick={onGoInventory}>
              View all inventory →
            </button>
          </div>
        </div>
        <div className="dashboard-deck-shell">
          <button
            type="button"
            className="dashboard-deck-arrow previous"
            onClick={() => moveCarousel(-1)}
            disabled={priorityAssets.length <= 1}
            aria-label="Previous priority asset"
          >
            ‹
          </button>
          <div
            ref={notificationCarouselRef}
            className={`dashboard-notification-carousel dashboard-circular-deck${carouselDragging ? " dragging" : ""}${carouselHoverDirection < 0 ? " edge-left" : carouselHoverDirection > 0 ? " edge-right" : ""}`}
            onPointerDown={beginCarouselDrag}
            onPointerMove={updateCarouselDrag}
            onPointerUp={endCarouselDrag}
            onPointerCancel={endCarouselDrag}
            onPointerLeave={() => {
              if (dragState.current.pointerId !== null && !dragState.current.moved) { dragState.current = { startX: 0, moved: false, pointerId: null }; setCarouselDragging(false); }
              if (!carouselDragging) {
                setCarouselHoverDirection(0);
              }
            }}
          >
            {priorityAssets.map(({ item, notice }, index) => {
              const level = LEVELS[notice.level];
              const offset = circularOffset(
                index,
                carouselIndex,
                priorityAssets.length,
              );
              if (Math.abs(offset) > 2) return null;
              const x = offset * 305 + carouselDragOffset;
              const depth = -Math.abs(offset) * 145;
              const scale = 1 - Math.abs(offset) * 0.13;
              return (
                <button
                  className={`dashboard-watch-card dashboard-deck-card${offset === 0 ? " active" : ""}`}
                  key={notice.id}
                  type="button"
                  data-level={notice.level.toLowerCase()}
                  style={{
                    "--deck-x": `${x}px`,
                    "--deck-z": `${depth}px`,
                    "--deck-turn": `${offset * -34}deg`,
                    "--deck-scale": scale,
                    "--deck-opacity": 1 - Math.abs(offset) * 0.24,
                    "--deck-speed": `${Math.round(560 - Math.abs(carouselHoverDirection) * 220)}ms`,
                    zIndex: 10 - Math.abs(offset),
                  }}
                  onClick={() => {
                    if (suppressCarouselClick.current) return;
                    if (offset === 0) onOpenNotification(notice);
                    else moveCarousel(offset > 0 ? 1 : -1);
                  }}
                >
                  <span className="dashboard-watch-model">
                    <span
                      className="dashboard-model-loader"
                      aria-hidden="true"
                    />
                    <canvas
                      data-model={glbUrl(item.model)}
                      style={{
                        position: "absolute",
                        zIndex: 2,
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </span>
                  <span className="dashboard-watch-copy">
                    <span
                      className="dashboard-watch-badge"
                      style={{
                        color: level.color,
                        background: level.background,
                        borderColor: level.border,
                      }}
                    >
                      {notice.level} · {notice.source}
                    </span>
                    <strong>{item.name}<StocktakeFlag item={item} /></strong>
                    <code>{item.tag}</code>
                    <p className="dashboard-watch-event">
                      <b>What is happening:</b> {notice.title}
                    </p>
                    <span className="dashboard-watch-detail">
                      {notice.detail}
                    </span>
                    <small className="dashboard-watch-context">
                      <b>Context:</b> {notice.meta}
                    </small>
                    <i>{offset === 0 ? "Open asset →" : "Bring forward"}</i>
                  </span>
                </button>
              );
            })}
            {!priorityAssets.length && (
              <div className="dashboard-watch-empty">
                <strong>Everything looks clear</strong>
                <span>No assets currently have notifications attached.</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="dashboard-deck-arrow next"
            onClick={() => moveCarousel(1)}
            disabled={priorityAssets.length <= 1}
            aria-label="Next priority asset"
          >
            ›
          </button>
        </div>
        {!!priorityAssets.length && (
          <div className="dashboard-deck-status">
            <span>
              <strong>{carouselIndex + 1}</strong> / {priorityAssets.length}
            </span>
            <div>
              {priorityAssets.slice(0, 12).map((entry, index) => (
                <button
                  key={entry.notice.id}
                  type="button"
                  className={index === carouselIndex ? "active" : ""}
                  onClick={() => {
                    persistedCarouselIndex = index;
                    setCarouselIndex(index);
                  }}
                  aria-label={`Show ${entry.item.name}`}
                />
              ))}
            </div>
            <small>
              {carouselActive
                ? "Autoplay pauses when this window is not active"
                : "Carousel paused"}
            </small>
          </div>
        )}
      </section>

      <section className="dashboard-watch dashboard-watch-legacy">
        <div className="dashboard-section-heading">
          <span>
            <small>Priority watchlist</small>
            <strong>Assets requiring attention</strong>
            <p>
              {priorityAssets.length} notification-linked asset
              {priorityAssets.length === 1 ? "" : "s"} cycling automatically
            </p>
          </span>
          <button type="button" onClick={onGoInventory}>
            View all inventory →
          </button>
        </div>
        <div
          ref={notificationCarouselRef}
          className="dashboard-notification-carousel"
        >
          {carouselAssets.map(({ item, notice }, index) => {
            const level = LEVELS[notice.level];
            return (
              <button
                className="dashboard-watch-card"
                key={`${notice.id}-${index < priorityAssets.length ? "original" : "cycle"}`}
                type="button"
                data-level={notice.level.toLowerCase()}
                onClick={() => onOpenNotification(notice)}
              >
                <span className="dashboard-watch-model">
                  <span className="dashboard-model-loader" aria-hidden="true" />
                  <canvas
                    data-model={glbUrl(item.model)}
                    style={{
                      position: "absolute",
                      zIndex: 2,
                      inset: 0,
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </span>
                <span className="dashboard-watch-copy">
                  <span
                    className="dashboard-watch-badge"
                    style={{
                      color: level.color,
                      background: level.background,
                      borderColor: level.border,
                    }}
                  >
                    {notice.level} · {notice.source}
                  </span>
                  <strong>{item.name}</strong>
                  <code>{item.tag}</code>
                  <p>{notice.title}</p>
                  <i>Open asset →</i>
                </span>
              </button>
            );
          })}
          {!priorityAssets.length && (
            <div className="dashboard-watch-empty">
              <strong>Everything looks clear</strong>
              <span>No assets currently have notifications attached.</span>
            </div>
          )}
        </div>
      </section>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel dashboard-notifications">
          <div className="dashboard-panel-heading">
            <span>
              <small>Activity stream</small>
              <strong>Notification centre</strong>
              <p>
                {criticalCount + actionCount} items currently require attention
              </p>
            </span>
            <div className="dashboard-notice-filters">
              {["All", "Critical", "Action", "Update"].map((filter) => {
                const count =
                  filter === "All"
                    ? notifications.length
                    : notifications.filter((notice) => notice.level === filter)
                        .length;
                return (
                  <button
                    key={filter}
                    type="button"
                    data-active={noticeFilter === filter}
                    onClick={() => setNoticeFilter(filter)}
                  >
                    {filter}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="dashboard-notice-list">
            {visibleNotifications.map((notice) => {
              const level = LEVELS[notice.level];
              return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => onOpenNotification(notice)}
                >
                  <span
                    className="dashboard-notice-mark"
                    style={{ color: level.color, background: level.background }}
                  >
                    ●
                  </span>
                  <span className="dashboard-notice-copy">
                    <span>
                      <strong>{notice.title}</strong>
                      <b
                        style={{
                          color: level.color,
                          background: level.background,
                        }}
                      >
                        {notice.level}
                      </b>
                    </span>
                    <p>{notice.detail}</p>
                    <small>
                      {notice.source} · {notice.meta}
                    </small>
                  </span>
                  <i>{notice.actionLabel || "Open"} →</i>
                </button>
              );
            })}
            {!visibleNotifications.length && (
              <div className="dashboard-empty-state">
                No {noticeFilter.toLowerCase()} notifications right now.
              </div>
            )}
          </div>
        </section>

        <aside className="dashboard-side-stack">
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading compact">
              <span>
                <small>Live workload</small>
                <strong>Operational queues</strong>
              </span>
              <b className="dashboard-live">Live</b>
            </div>
            <div className="dashboard-queue-list">
              {queueRows.map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => onOpenSummary(row.target)}
                >
                  <span style={{ background: row.color }} />
                  <strong>{row.label}</strong>
                  <b>{row.value}</b>
                  <i>→</i>
                </button>
              ))}
            </div>
          </section>
          <section className="dashboard-panel dashboard-footprint">
            <div className="dashboard-panel-heading compact">
              <span>
                <small>Campus footprint</small>
                <strong>Inventory position</strong>
              </span>
              <button type="button" onClick={onGoInventory}>
                Explore →
              </button>
            </div>
            <div className="dashboard-footprint-total">
              <span>
                <strong>{items.length}</strong>
                <small>Asset records</small>
              </span>
              <span>
                <strong>{money(totalValue)}</strong>
                <small>Recorded value</small>
              </span>
            </div>
            <div className="dashboard-building-list">
              {buildingCounts.map((building) => (
                <div key={building.name}>
                  <span>{building.name}</span>
                  <i>
                    <b
                      style={{
                        width: `${Math.round((building.count / maxBuilding) * 100)}%`,
                      }}
                    />
                  </i>
                  <strong>{building.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {notificationCenterOpen && (
        <div
          className="dashboard-notification-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setNotificationCenterOpen(false);
            }
          }}
        >
          <section
            className="dashboard-notification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-notification-modal-title"
          >
            <header>
              <span>
                <small>Live operational activity</small>
                <strong id="dashboard-notification-modal-title">
                  Notification centre
                </strong>
                <p>
                  {criticalCount} critical and {actionCount} action notification
                  {criticalCount + actionCount === 1 ? "" : "s"} require review.
                </p>
              </span>
              <button
                type="button"
                onClick={() => setNotificationCenterOpen(false)}
                aria-label="Close notification centre"
              >
                ×
              </button>
            </header>
            <div className="dashboard-notification-modal-toolbar">
              <div className="dashboard-notice-filters">
                {["All", "Critical", "Action", "Update"].map((filter) => {
                  const count =
                    filter === "All"
                      ? notifications.length
                      : notifications.filter((notice) => notice.level === filter)
                          .length;
                  return (
                    <button
                      key={filter}
                      type="button"
                      data-active={noticeFilter === filter}
                      onClick={() => setNoticeFilter(filter)}
                    >
                      {filter}<span>{count}</span>
                    </button>
                  );
                })}
              </div>
              <small>Click a notification to open its related record.</small>
            </div>
            <div className="dashboard-notice-list dashboard-notification-modal-list">
              {visibleNotifications.map((notice) => {
                const level = LEVELS[notice.level];
                return (
                  <button
                    key={notice.id}
                    type="button"
                    onClick={() => {
                      setNotificationCenterOpen(false);
                      onOpenNotification(notice);
                    }}
                  >
                    <span
                      className="dashboard-notice-mark"
                      style={{ color: level.color, background: level.background }}
                    >
                      ●
                    </span>
                    <span className="dashboard-notice-copy">
                      <span>
                        <strong>{notice.title}</strong>
                        <b style={{ color: level.color, background: level.background }}>
                          {notice.level}
                        </b>
                      </span>
                      <p>{notice.detail}</p>
                      <small>{notice.source} · {notice.meta}</small>
                    </span>
                    <i>{notice.actionLabel || "Open"} →</i>
                  </button>
                );
              })}
              {!visibleNotifications.length && (
                <div className="dashboard-empty-state">
                  No {noticeFilter.toLowerCase()} notifications right now.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default memo(Dashboard, (previous, next) => previous.items === next.items
  && previous.requests === next.requests
  && previous.orders === next.orders
  && previous.placements === next.placements
  && previous.history === next.history
  && previous.availableScreens === next.availableScreens
  && previous.isActive === next.isActive);
