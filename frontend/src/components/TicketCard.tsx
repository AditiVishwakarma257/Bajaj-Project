import React from "react";
import { Ticket, Status } from "../types";
import { api } from "../api";

interface Props {
  ticket: Ticket;
  onUpdated: (ticket: Ticket) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}

const NEXT_STATUSES: Record<Status, Status[]> = {
  open: ["in_progress"],
  in_progress: ["open", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export const TicketCard: React.FC<Props> = ({ ticket, onUpdated, onDeleted, onError }) => {
  const [moving, setMoving] = React.useState<Status | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleMove = async (toStatus: Status) => {
    setMoving(toStatus);
    try {
      const updated = await api.updateStatus(ticket._id, toStatus);
      onUpdated(updated);
    } catch (err: any) {
      onError(err.message || "Failed to update ticket");
    } finally {
      setMoving(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ticket "${ticket.subject}"?`)) return;
    setDeleting(true);
    try {
      await api.deleteTicket(ticket._id);
      onDeleted(ticket._id);
    } catch (err: any) {
      onError(err.message || "Failed to delete ticket");
      setDeleting(false);
    }
  };

  const nextStatuses = NEXT_STATUSES[ticket.status];

  return (
    <div className={`card priority-${ticket.priority}`} data-testid={`card-${ticket._id}`}>
      <div className="card-top">
        <span className="card-subject">{ticket.subject}</span>
        <button
          className="card-delete"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete ticket"
          title="Delete ticket"
        >
          {deleting ? "…" : "✕"}
        </button>
      </div>

      <div className="card-meta">
        <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
        <span className="card-age">⏱ {formatAge(ticket.ageMinutes)}</span>
      </div>

      {ticket.slaBreached && (
        <div className="sla-warning">
          <span>⚡</span>
          <span>SLA Breached</span>
        </div>
      )}

      {nextStatuses.length > 0 && (
        <div className="card-actions">
          {nextStatuses.map((s) => (
            <button
              key={s}
              className="btn-move"
              onClick={() => handleMove(s)}
              disabled={moving === s}
              id={`move-${ticket._id}-to-${s}`}
            >
              {moving === s ? "…" : `→ ${STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
