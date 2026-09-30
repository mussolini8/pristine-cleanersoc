"use client";

import { usePathname } from "next/navigation";
import { GlobalAiBubble } from "./global-ai-bubble";

export function GlobalCopilotWrapper() {
  const pathname = usePathname();

  // Hide on public authentication pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return <GlobalAiBubble />;
}
