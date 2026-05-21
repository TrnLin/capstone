import { useState } from "react"
import { ChevronDownIcon, CodeIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"
import type { InferenceResult } from "~/lib/mock-api"

type JsonInspectorProps = {
  result: InferenceResult | null
}

export function JsonInspector({ result }: JsonInspectorProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!result) return null

  const payload = JSON.stringify(result, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* noop */
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 px-4 py-3">
          <CodeIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-medium">
            Raw inference response
          </h2>
          <span className="text-xs text-muted-foreground">
            matches FastAPI contract
          </span>
          <div className="flex-1" />
          <Button variant="ghost" size="xs" onClick={handleCopy}>
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={open ? "Collapse JSON" : "Expand JSON"}
              />
            }
          >
            <ChevronDownIcon
              className={cn(
                "transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0">
          <div className="border-t border-border">
            <pre className="max-h-80 overflow-auto bg-muted/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/85">
              <code>{payload}</code>
            </pre>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
