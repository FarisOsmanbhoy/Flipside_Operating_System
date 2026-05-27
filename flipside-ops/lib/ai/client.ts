// Server-only guarded entry point. App code imports from here.
// Smoke scripts import `./_client-core` directly to bypass the server-only
// guard (Node scripts aren't a "client component" but the package can't tell).
import "server-only";

export * from "./_client-core";
