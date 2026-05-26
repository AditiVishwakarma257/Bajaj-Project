import type { Context } from "@netlify/functions";
import { connectDB } from "./lib/db.mjs";
import { Ticket } from "./lib/ticket.model.mjs";
import {
  withDerivedFields,
  canTransition,
  allowedNext,
  sendJSON,
  getHeaders,
} from "./lib/helpers.mjs";

// this function handles all /tickets routes
export const config = {
  path: ["/tickets", "/tickets/*"],
};

export default async (req: Request, context: Context) => {
  // allow browser preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getHeaders() });
  }

  // connect to database
  try {
    await connectDB();
  } catch (err: any) {
    return sendJSON({ error: "Could not connect to database", detail: err.message }, 500);
  }

  const url = new URL(req.url);

  // strip the /tickets prefix to get the rest of the path
  const rest = url.pathname.replace(/^\/tickets\/?/, "").split("/").filter(Boolean);
  const id = rest[0] || null;
  const isStatsRoute = id === "stats";
  const method = req.method;

  // ── GET /tickets/stats ───────────────────────────────────────────────────────
  if (method === "GET" && isStatsRoute) {
    const all = await Ticket.find({}).lean();

    // group by status
    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    let slaBreachedOpen = 0;

    for (const t of all) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

      const derived = withDerivedFields(t as any);
      if (derived.slaBreached && t.status !== "resolved" && t.status !== "closed") {
        slaBreachedOpen++;
      }
    }

    return sendJSON({ byStatus, byPriority, slaBreachedOpen });
  }

  // ── GET /tickets ─────────────────────────────────────────────────────────────
  if (method === "GET" && !id) {
    const query: Record<string, any> = {};

    // optional filters from query string
    const statusFilter = url.searchParams.get("status");
    const priorityFilter = url.searchParams.get("priority");
    const breachedFilter = url.searchParams.get("breached");

    if (statusFilter) query.status = statusFilter;
    if (priorityFilter) query.priority = priorityFilter;

    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).lean();
    let results = tickets.map((t) => withDerivedFields(t as any));

    // filter by SLA breach after fetching (it's computed, not stored)
    if (breachedFilter === "true") {
      results = results.filter((t) => t.slaBreached);
    }

    return sendJSON(results);
  }

  // ── POST /tickets ─────────────────────────────────────────────────────────────
  if (method === "POST" && !id) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return sendJSON({ error: "Request body must be valid JSON" }, 400);
    }

    const { subject, description, customerEmail, priority } = body || {};
    const problems: string[] = [];

    if (!subject?.trim()) problems.push("subject is required");
    if (!description?.trim()) problems.push("description is required");

    if (!customerEmail) {
      problems.push("customerEmail is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      problems.push("customerEmail must be a valid email");
    }

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!priority) {
      problems.push("priority is required");
    } else if (!validPriorities.includes(priority)) {
      problems.push(`priority must be one of: ${validPriorities.join(", ")}`);
    }

    if (problems.length > 0) {
      return sendJSON({ error: "Validation failed", details: problems }, 400);
    }

    const ticket = await Ticket.create({
      subject: subject.trim(),
      description: description.trim(),
      customerEmail: customerEmail.trim(),
      priority,
    });

    return sendJSON(withDerivedFields(ticket as any), 201);
  }

  // ── PATCH /tickets/:id ────────────────────────────────────────────────────────
  if (method === "PATCH" && id && !isStatsRoute) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return sendJSON({ error: "Request body must be valid JSON" }, 400);
    }

    const { status: newStatus } = body || {};
    if (!newStatus) return sendJSON({ error: "status field is required in request body" }, 400);

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(newStatus)) {
      return sendJSON({ error: `status must be one of: ${validStatuses.join(", ")}` }, 400);
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) return sendJSON({ error: "Ticket not found" }, 404);

    // nothing to do if status hasn't changed
    if (ticket.status === newStatus) {
      return sendJSON(withDerivedFields(ticket as any));
    }

    // check transition rules
    if (!canTransition(ticket.status, newStatus)) {
      const allowed = allowedNext(ticket.status);
      return sendJSON({
        error: `Cannot move from '${ticket.status}' to '${newStatus}'. Allowed next: ${allowed.length ? allowed.join(", ") : "none"}`,
      }, 400);
    }

    // update status and handle resolvedAt
    ticket.status = newStatus as any;

    if (newStatus === "resolved") {
      ticket.resolvedAt = new Date();
    } else if (ticket.resolvedAt) {
      // moving away from resolved clears the resolved timestamp
      ticket.resolvedAt = undefined;
    }

    await ticket.save();
    return sendJSON(withDerivedFields(ticket as any));
  }

  // ── DELETE /tickets/:id ───────────────────────────────────────────────────────
  if (method === "DELETE" && id && !isStatsRoute) {
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) return sendJSON({ error: "Ticket not found" }, 404);
    return sendJSON({ message: "Ticket deleted successfully", id });
  }

  return sendJSON({ error: "Route not found" }, 404);
};
