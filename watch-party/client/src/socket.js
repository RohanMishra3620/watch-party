import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

// A single shared socket instance for the whole app. Created lazily so we
// don't open a connection before it's actually needed, but reused across
// every page so room state survives client-side navigation.
export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
