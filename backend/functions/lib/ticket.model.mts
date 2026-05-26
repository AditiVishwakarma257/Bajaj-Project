import mongoose, { Schema, Document } from "mongoose";

// what a ticket looks like in the database
export interface ITicket extends Document {
  subject: string;
  description: string;
  customerEmail: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: Date;
  resolvedAt?: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, "Customer email is required"],
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      required: [true, "Priority is required"],
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // auto-adds createdAt
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

// prevent model recompilation on hot-reload
export const Ticket =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", ticketSchema);
