"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: only fires if a root layout itself throws (e.g.
 * (public)/layout.tsx's `supabase.auth.getUser()` call), which
 * (public)/error.tsx can't catch since that error happens above it in
 * the tree. Next.js requires this file to render its own <html>/<body> —
 * it fully replaces the root layout when active, so it can't reuse any
 * shared chrome or Tailwind classes that assume that layout ran.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          background: "#0b0d10",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong.</h1>
        <p style={{ maxWidth: "24rem", color: "#a1a1aa", fontSize: "0.875rem" }}>
          The app hit an unexpected error before it could even render its layout. Reloading usually fixes this.
        </p>
        {error.digest && <p style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.375rem",
            background: "#bbf90a",
            color: "#0b0d10",
            fontWeight: 600,
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
