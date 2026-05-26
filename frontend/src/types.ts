export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "open" | "in_progress" | "resolved" | "closed";

export interface Ticket {
  _id: string;
  subject: string;
  description: string;
  customerEmail: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  resolvedAt?: string | null;
  ageMinutes: number;
  slaBreached: boolean;
}

export interface Stats {
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  slaBreachedOpen: number;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  customerEmail: string;
  priority: Priority;
}
