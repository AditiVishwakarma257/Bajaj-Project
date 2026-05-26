import mongoose from "mongoose";

// grab the URI from netlify env
const uri = Netlify.env.get("MONGODB_URI") || "";

// keep a single connection alive across function calls
let conn: mongoose.Connection | null = null;

export async function connectDB() {
  // reuse if already connected
  if (conn && conn.readyState === 1) return conn;

  if (!uri) throw new Error("MONGODB_URI is not set in environment variables");

  const result = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  });

  conn = result.connection;
  return conn;
}
