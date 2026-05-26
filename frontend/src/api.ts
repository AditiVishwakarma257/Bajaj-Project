import { Ticket, Stats, CreateTicketPayload } from "./types";

const BASE = "/tickets";

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  getTickets: (params?: Record<string, string>): Promise<Ticket[]> => {
    const url = new URL(BASE, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url.toString()).then((r) => handleResponse<Ticket[]>(r));
  },

  getStats: (): Promise<Stats> =>
    fetch(`${BASE}/stats`).then((r) => handleResponse<Stats>(r)),

  createTicket: (payload: CreateTicketPayload): Promise<Ticket> =>
    fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => handleResponse<Ticket>(r)),

  updateStatus: (id: string, status: string): Promise<Ticket> =>
    fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => handleResponse<Ticket>(r)),

  deleteTicket: (id: string): Promise<{ message: string }> =>
    fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) =>
      handleResponse<{ message: string }>(r)
    ),
};
