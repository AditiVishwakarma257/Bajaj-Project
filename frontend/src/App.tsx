import React, { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Ticket, Status, Priority, Stats } from "./types";
import { api } from "./api";
import { CreateTicketModal } from "./components/CreateTicketModal";
import { TicketCard } from "./components/TicketCard";
import "./index.css";

const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: "open", label: "Open", color: "#6366f1" },
  { status: "in_progress", label: "In Progress", color: "#f59e0b" },
  { status: "resolved", label: "Resolved", color: "#10b981" },
  { status: "closed", label: "Closed", color: "#6b7280" },
];

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

const VALID_DROPS: Record<Status, Status[]> = {
  open: ["in_progress"],
  in_progress: ["open", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

interface Toast { id: number; message: string; type: "success" | "error" }

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [tix, st] = await Promise.all([api.getTickets(), api.getStats()]);
      setTickets(tix);
      setStats(st);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh stats after any ticket change
  const refreshStats = useCallback(async () => {
    try {
      const st = await api.getStats();
      setStats(st);
    } catch {}
  }, []);

  const handleCreated = useCallback((ticket: Ticket) => {
    setTickets((p) => [ticket, ...p]);
    refreshStats();
    addToast("Ticket created successfully", "success");
  }, [refreshStats, addToast]);

  const handleUpdated = useCallback((updated: Ticket) => {
    setTickets((p) => p.map((t) => (t._id === updated._id ? updated : t)));
    refreshStats();
  }, [refreshStats]);

  const handleDeleted = useCallback((id: string) => {
    setTickets((p) => p.filter((t) => t._id !== id));
    refreshStats();
    addToast("Ticket deleted", "success");
  }, [refreshStats, addToast]);

  // Drag and drop
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const fromStatus = source.droppableId as Status;
    const toStatus = destination.droppableId as Status;

    if (!VALID_DROPS[fromStatus]?.includes(toStatus)) {
      addToast(`Cannot move from ${fromStatus} → ${toStatus}`, "error");
      return;
    }

    const prev = tickets.find((t) => t._id === draggableId);
    if (!prev) return;

    // Optimistic update
    setTickets((p) =>
      p.map((t) => (t._id === draggableId ? { ...t, status: toStatus } : t))
    );

    try {
      const updated = await api.updateStatus(draggableId, toStatus);
      setTickets((p) => p.map((t) => (t._id === draggableId ? updated : t)));
      refreshStats();
    } catch (err: any) {
      // Revert
      setTickets((p) => p.map((t) => (t._id === draggableId ? prev : t)));
      addToast(err.message || "Move failed — snapping back", "error");
    }
  }, [tickets, addToast, refreshStats]);

  // Filtered tickets
  const filtered = tickets.filter((t) => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (breachedOnly && !t.slaBreached) return false;
    return true;
  });

  const byStatus = (status: Status) => filtered.filter((t) => t.status === status);

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-icon">🎯</div>
          <span>DeskFlow</span>
        </div>
        <button className="btn-create" id="create-ticket-btn" onClick={() => setShowCreate(true)}>
          + New Ticket
        </button>
      </header>

      {/* Stats Strip */}
      <div className="stats-strip">
        {stats ? (
          <>
            {COLUMNS.map(({ status, label, color }) => (
              <div className="stat-chip" key={status}>
                <span className="dot" style={{ background: color }} />
                <strong>{stats.byStatus[status] ?? 0}</strong>
                <span>{label}</span>
              </div>
            ))}
            <div className="stat-chip breached">
              <span>⚡</span>
              <strong>{stats.slaBreachedOpen}</strong>
              <span>SLA Breached</span>
            </div>
          </>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading stats…</span>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="priority-filter">Priority:</label>
          <select
            id="priority-filter"
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
        <button
          id="breached-toggle"
          className={`toggle-btn${breachedOnly ? " active" : ""}`}
          onClick={() => setBreachedOnly((b) => !b)}
        >
          ⚡ {breachedOnly ? "Showing SLA Breached" : "All SLA Status"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          ⚠ {error}
          <button style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }} onClick={fetchAll}>Retry</button>
        </div>
      )}

      {/* Board */}
      <div className="board-container">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="board">
              {COLUMNS.map(({ status, label, color }) => {
                const colTickets = byStatus(status);
                return (
                  <div className="column" key={status}>
                    <div className="column-header">
                      <div className="column-accent" style={{ background: color }} />
                      <span className="column-title" style={{ color }}>{label}</span>
                      <span className="column-count">{colTickets.length}</span>
                    </div>
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          className="column-body"
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            background: snapshot.isDraggingOver
                              ? "rgba(99,102,241,0.05)"
                              : undefined,
                          }}
                        >
                          {colTickets.length === 0 ? (
                            <div className="column-empty">
                              <span style={{ fontSize: "1.5rem" }}>📭</span>
                              <span>No tickets</span>
                            </div>
                          ) : (
                            colTickets.map((ticket, index) => (
                              <Draggable key={ticket._id} draggableId={ticket._id} index={index}>
                                {(prov, snap) => (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                    className={snap.isDragging ? "dragging" : ""}
                                  >
                                    <TicketCard
                                      ticket={ticket}
                                      onUpdated={handleUpdated}
                                      onDeleted={handleDeleted}
                                      onError={(msg) => addToast(msg, "error")}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateTicketModal
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Toasts */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </>
  );
}
