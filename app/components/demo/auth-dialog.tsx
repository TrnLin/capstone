import { useEffect, useState } from "react"
import { Loader2Icon, LogInIcon, UserPlusIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { cn } from "~/lib/utils"

type AuthMode = "login" | "register"

type AuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function AuthDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  error,
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (!open) {
      setPassword("")
      return
    }
    setMode("login")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect to backend</DialogTitle>
          <DialogDescription>
            Sign in to submit studies, poll prediction jobs, and load saved
            results from the FastAPI service.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              mode === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogInIcon className="size-3.5" />
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserPlusIcon className="size-3.5" />
            Register
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()
            await onSubmit(mode, email, password)
          }}
        >
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              autoComplete="email"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/35"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/35"
              placeholder="At least 8 characters"
            />
          </Field>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : null}
            {mode === "login" ? "Login" : "Create account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
