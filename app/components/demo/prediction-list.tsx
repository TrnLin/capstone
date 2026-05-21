import { useState } from "react"
import { ChevronDownIcon, TargetIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"
import { LABELS_BY_ID, NO_FINDING_ID } from "~/lib/labels"
import type { InferenceResult, Prediction } from "~/lib/mock-api"

import { PrototypeThumbnail } from "./prototype-thumbnail"

type PredictionListProps = {
  result: InferenceResult | null
  loading: boolean
  threshold: number
  activeLabelId: number | null
  onFocusLabel: (id: number | null) => void
  onOpenPrototypeGallery: (id: number) => void
}

export function PredictionList({
  result,
  loading,
  threshold,
  activeLabelId,
  onFocusLabel,
  onOpenPrototypeGallery,
}: PredictionListProps) {
  if (loading || !result) {
    return <PredictionListSkeleton />
  }

  const activeCount = result.predictions.filter(
    (p) => p.labelId !== NO_FINDING_ID && p.probability >= threshold
  ).length

  const topPathology = result.predictions.find(
    (p) => p.labelId !== NO_FINDING_ID
  )
  const noFinding = result.predictions.find(
    (p) => p.labelId === NO_FINDING_ID
  )
  const noFindingDominates =
    noFinding !== undefined &&
    (!topPathology || noFinding.probability > topPathology.probability)

  const rest = result.predictions.filter((p) => {
    if (noFindingDominates && p.labelId === NO_FINDING_ID) return false
    return true
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Predictions
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeCount} above threshold · {result.predictions.length} labels
        </span>
      </div>

      {noFindingDominates && noFinding && (
        <NoFindingRow prediction={noFinding} />
      )}

      <div className="flex flex-col gap-1.5">
        {rest.map((p) => (
          <PredictionRow
            key={p.labelId}
            prediction={p}
            result={result}
            threshold={threshold}
            isActive={activeLabelId === p.labelId}
            onFocusLabel={onFocusLabel}
            onOpenPrototypeGallery={onOpenPrototypeGallery}
          />
        ))}
      </div>
    </div>
  )
}

function PredictionRow({
  prediction,
  result,
  threshold,
  isActive,
  onFocusLabel,
  onOpenPrototypeGallery,
}: {
  prediction: Prediction
  result: InferenceResult
  threshold: number
  isActive: boolean
  onFocusLabel: (id: number | null) => void
  onOpenPrototypeGallery: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const label = LABELS_BY_ID[prediction.labelId]
  if (!label) return null

  const isNoFinding = prediction.labelId === NO_FINDING_ID
  const isAbove = prediction.probability >= threshold
  const top3Prototypes = result.prototypes
    .filter((p) => p.labelId === prediction.labelId)
    .slice(0, 3)

  const handleSelect = () => {
    if (isActive) onFocusLabel(null)
    else onFocusLabel(prediction.labelId)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group/row rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10 transition-colors",
          isActive && "ring-2 ring-foreground/40",
          !isAbove && !isNoFinding && "opacity-55"
        )}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSelect}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
            aria-label={`Focus ${label.name} overlay`}
            aria-pressed={isActive}
            disabled={isNoFinding}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: label.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {label.name}
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground group-hover/row:text-foreground">
              {(prediction.probability * 100).toFixed(1)}%
            </span>
          </button>
          {!isNoFinding && (
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={open ? "Collapse details" : "Expand details"}
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
          )}
        </div>

        <ProbabilityBar
          value={prediction.probability}
          threshold={threshold}
          color={label.color}
          className="mt-2"
        />

        {!isNoFinding && (
          <CollapsibleContent className="overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0">
            <div className="mt-3 space-y-2.5 border-t border-border pt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {label.clinicalNote}
              </p>
              {top3Prototypes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Nearest prototypes
                    </span>
                    <Button
                      variant="link"
                      size="xs"
                      onClick={() =>
                        onOpenPrototypeGallery(prediction.labelId)
                      }
                      className="h-auto p-0 text-xs"
                    >
                      View all
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {top3Prototypes.map((p) => (
                      <div
                        key={p.prototypeId}
                        className="flex w-20 flex-col gap-1"
                      >
                        <div className="aspect-square w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
                          <PrototypeThumbnail
                            seed={p.thumbnailSeed}
                            labelId={p.labelId}
                          />
                        </div>
                        <div className="flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
                          <span className="tabular-nums">
                            {Math.round(p.similarity * 100)}%
                          </span>
                          <Badge
                            variant="outline"
                            className="h-4 px-1 py-0 text-[9px]"
                          >
                            {p.sourceDataset}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {prediction.bbox && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TargetIcon className="size-3" />
                  <span className="font-mono tabular-nums">
                    bbox [{prediction.bbox.map((n) => n.toFixed(2)).join(", ")}]
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

function NoFindingRow({ prediction }: { prediction: Prediction }) {
  const label = LABELS_BY_ID[prediction.labelId]!
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-500/15">
        <svg
          viewBox="0 0 14 14"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7.5 L6 10.5 L11 4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label.name}</p>
        <p className="text-[11px] text-emerald-800/70 dark:text-emerald-200/70">
          Absence does not rule out clinical disease.
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {(prediction.probability * 100).toFixed(1)}%
      </span>
    </div>
  )
}

function ProbabilityBar({
  value,
  threshold,
  color,
  className,
}: {
  value: number
  threshold: number
  color: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${Math.min(100, Math.max(2, value * 100))}%`,
          backgroundColor: color,
          opacity: value >= threshold ? 1 : 0.5,
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/40"
        style={{ left: `${threshold * 100}%` }}
        aria-hidden="true"
      />
    </div>
  )
}

function PredictionListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
      ))}
    </div>
  )
}
