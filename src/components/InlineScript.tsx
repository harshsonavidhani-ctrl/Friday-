"use client";

/**
 * A script the browser runs while reading the page — before anything is drawn.
 * (Pattern from the Next.js "preventing flash before hydration" guide: real on
 * the server, inert text on the client so React does not warn.)
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
