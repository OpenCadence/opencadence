import "server-only";

// Keep the Next.js client boundary explicit; MCP imports the Node-only layer.
export { db, getWorkspace, getRevision, isFirstRunPending } from "./storage";
