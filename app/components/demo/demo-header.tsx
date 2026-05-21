import { useEffect, useState } from "react"
import { Link } from "react-router"
import { MoonIcon, SunIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export function DemoHeader() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const stored = localStorage.getItem("muck-theme")
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initial = (stored ?? (prefers ? "dark" : "light")) as "light" | "dark"
    setTheme(initial)
    document.documentElement.classList.toggle("dark", initial === "dark")
  }, [])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    localStorage.setItem("muck-theme", next)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-foreground text-background">
            <MuckMark />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-sm font-semibold tracking-tight">
              Muck
            </span>
            <span className="text-[11px] text-muted-foreground">
              Interpretable CXR Classification
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "ml-2 gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700",
            "dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
          )}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          demo mode
        </Badge>

        <div className="flex-1" />

        <Link
          to="/legacy"
          title="View the original 1999-style demo"
          className="hidden h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          legacy ui
        </Link>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
  )
}

function MuckMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 16 V4 L7 10 L10 4 L13 10 L17 4 V16" />
    </svg>
  )
}
