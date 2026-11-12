"use client";

import { useEffect } from "react";

/**
 * Netlify puts a "Powered by Netlify" badge in the bottom-right corner of sites on
 * its free plan (it cannot be hidden there). When it is on screen, this sets
 * --badge to its height so every bottom bar (menus, cart bar, Save bars) sits just
 * above it and nothing is covered. No badge (laptop, or a paid plan) → --badge 0.
 */
export function NetlifyBadgeSpace() {
  useEffect(() => {
    const root = document.documentElement;
    const check = () => {
      const f = document.getElementById("nl-badge-frame");
      if (!f) {
        root.classList.remove("nl-badge");
        return;
      }
      const h = f.getBoundingClientRect().height;
      // closed badge: a small frame; the visible pill starts `top` px below the frame's top
      if (h <= 0 || h > 110) return; // not sized yet, or opened by a tap — keep the last value
      const tops = [...(f.style.clipPath || "").matchAll(/M\s*[\d.]+\s+([\d.]+)/g)].map((m) => Number(m[1]));
      const top = tops.length ? Math.min(...tops) : 0;
      const space = Math.round(Math.min(100, Math.max(40, h - top)));
      root.style.setProperty("--nl-badge-h", `${space}px`);
      root.classList.add("nl-badge");
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true });
    // the badge sizes itself a moment after its script loads
    const timer = setInterval(check, 1000);
    const stop = setTimeout(() => clearInterval(timer), 20000);
    return () => {
      mo.disconnect();
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, []);
  return null;
}
