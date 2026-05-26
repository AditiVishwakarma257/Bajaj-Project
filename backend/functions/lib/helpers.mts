import { ITicket } from "./ticket.model.mjs";

// how long (in minutes) each priority is allowed before SLA is breached
const SLA_TARGETS: Record<string, number> = {
  urgent: 60,
  high: 240,
  medium: 1440,
  low: 4320,
};

// which status can move to which
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress"],
  in_progress: ["open", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export function canTransition(from: string, to: string) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedNext(from: string) {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// attach computed fields to a ticket before sending to client
export function withDerivedFields(ticket: ITicket) {
  const now = new Date();
  const created = new Date(ticket.createdAt);
  const slaLimit = SLA_TARGETS[ticket.priority] ?? 4320;

  let ageMinutes: number;
  let slaBreached: boolean;

  if (ticket.status === "resolved" && ticket.resolvedAt) {
    // for resolved tickets, age = time from create to resolution
    ageMinutes = Math.floor(
      (new Date(ticket.resolvedAt).getTime() - created.getTime()) / 60000
    );
    slaBreached = ageMinutes > slaLimit;
  } else if (ticket.status === "closed") {
    const end = ticket.resolvedAt ? new Date(ticket.resolvedAt) : now;
    ageMinutes = Math.floor((end.getTime() - created.getTime()) / 60000);
    slaBreached = ageMinutes > slaLimit;
  } else {
    // for open/in-progress, count from now
    ageMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    slaBreached = ageMinutes > slaLimit;
  }

  return {
    _id: ticket._id,
    subject: ticket.subject,
    description: ticket.description,
    customerEmail: ticket.customerEmail,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    resolvedAt: ticket.resolvedAt ?? null,
    ageMinutes,
    slaBreached,
  };
}

// standard headers for every response
export function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function sendJSON(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getHeaders(),
  });
}
