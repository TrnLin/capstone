import { useState } from "react"
import { ChevronDownIcon, CodeIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { cn } from "~/lib/utils"
import type { InferenceResult } from "~/lib/inference"

type JsonInspectorProps = {
  result: InferenceResult | null
}

export function JsonInspector({ result }: JsonInspectorProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!result) return null

  const payload = JSON.stringify(result.sanitizedResponse, null, 2)
  const timings = Object.entries(result.timingsMs)

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
            Backend model output
          </h2>
          <span className="text-xs text-muted-foreground">
            binary image bodies omitted
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
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <ModelMetric
                label="Model cutoff"
                value={result.modelThreshold.toFixed(2)}
              />
              <ModelMetric
                label="Backend total"
                value={`${result.inferenceMs} ms`}
              />
              <ModelMetric
                label="Predictions"
                value={String(result.predictions.length)}
              />
              <ModelMetric
                label="Image ID"
                value={result.backend.imageId ?? "—"}
              />
              <ModelMetric
                label="Prediction ID"
                value={result.backend.predictionId ?? "—"}
              />
            </div>
            {timings.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Inference timing
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
                  {timings.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 border-b border-border/60 pb-1"
                    >
                      <span
                        className="truncate text-muted-foreground"
                        title={key}
                      >
                        {timingLabel(key)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {value.toFixed(2)} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {result.normalizationWarnings.length > 0 ? (
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                {result.normalizationWarnings.join(" ")}
              </div>
            ) : null}
            <div className="space-y-2">
              <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Sanitized backend response
              </h3>
              <pre className="max-h-80 overflow-auto bg-muted/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                <code>{payload}</code>
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function ModelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium tabular-nums" title={value}>
        {value}
      </div>
    </div>
  )
}

function timingLabel(key: string) {
  return key
    .replace(/_ms$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
