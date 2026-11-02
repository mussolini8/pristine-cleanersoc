"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isEn } = useLanguage();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={isEn ? "Toggle dark mode" : "Cambiar modo oscuro"}
      size="icon"
      variant="outline"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
