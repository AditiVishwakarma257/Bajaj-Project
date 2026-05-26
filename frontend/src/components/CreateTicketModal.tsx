import React, { useState, useCallback } from "react";
import { Ticket, Priority } from "../types";
import { api } from "../api";

interface Props {
  onCreated: (ticket: Ticket) => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

interface FormState {
  subject: string;
  description: string;
  customerEmail: string;
  priority: Priority;
}

interface FormErrors {
  subject?: string;
  description?: string;
  customerEmail?: string;
  priority?: string;
}

export const CreateTicketModal: React.FC<Props> = ({ onCreated, onClose }) => {
  const [form, setForm] = useState<FormState>({
    subject: "",
    description: "",
    customerEmail: "",
    priority: "medium",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.customerEmail.trim()) {
      e.customerEmail = "Customer email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      e.customerEmail = "Must be a valid email address";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError(null);
    try {
      const ticket = await api.createTicket({
        subject: form.subject.trim(),
        description: form.description.trim(),
        customerEmail: form.customerEmail.trim(),
        priority: form.priority,
      });
      onCreated(ticket);
      onClose();
    } catch (err: any) {
      setApiError(err.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  }, [form, onCreated, onClose]);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <span className="modal-title" id="modal-title">✦ Create New Ticket</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {apiError && (
              <div className="error-banner" style={{ margin: "0 0 1rem" }}>⚠ {apiError}</div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="cf-subject">Subject *</label>
              <input
                id="cf-subject"
                className={`form-input${errors.subject ? " error" : ""}`}
                placeholder="Brief summary of the issue"
                value={form.subject}
                onChange={set("subject")}
                maxLength={200}
              />
              {errors.subject && <p className="form-error">{errors.subject}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cf-desc">Description *</label>
              <textarea
                id="cf-desc"
                className={`form-textarea${errors.description ? " error" : ""}`}
                placeholder="Detailed description of the issue..."
                value={form.description}
                onChange={set("description")}
                rows={4}
              />
              {errors.description && <p className="form-error">{errors.description}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cf-email">Customer Email *</label>
              <input
                id="cf-email"
                type="email"
                className={`form-input${errors.customerEmail ? " error" : ""}`}
                placeholder="customer@example.com"
                value={form.customerEmail}
                onChange={set("customerEmail")}
              />
              {errors.customerEmail && <p className="form-error">{errors.customerEmail}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cf-priority">Priority *</label>
              <select
                id="cf-priority"
                className="form-select"
                value={form.priority}
                onChange={set("priority")}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} id="create-submit-btn">
              {loading ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
