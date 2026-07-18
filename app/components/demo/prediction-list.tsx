import { useState } from "react"
import { ChevronDownIcon, SparklesIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Skeleton } from "~/components/ui/skeleton"
import type {
  InferencePrediction,
  InferenceResult,
  PrototypeMatch,
} from "~/lib/inference"
import { LABELS_BY_ID, NO_FINDING_ID } from "~/lib/labels"
import { cn } from "~/lib/utils"

import { ExplanationImage } from "./explanation-image"

type PredictionListProps = {
  result: InferenceResult | null
  loading: boolean
  displayThreshold: number
  activePredictionKey: string | null
  onFocusPrediction: (key: string | null) => void
  onOpenPrototypeGallery: (key: string) => void
}

export function PredictionList({
  result,
  loading,
  displayThreshold,
  activePredictionKey,
  onFocusPrediction,
  onOpenPrototypeGallery,
}: PredictionListProps) {
  if (loading) return <PredictionListSkeleton />
  if (!result) {
    return (
      <div className="grid min-h-40 place-items-center p-4 text-center text-xs text-muted-foreground">
        <div className="max-w-48 space-y-2">
          <SparklesIcon className="mx-auto size-4 opacity-60" />
          <p className="text-pretty">
            Submit a study to inspect model decisions and backend explanations.
          </p>
        </div>
      </div>
    )
  }

  const activeCount = result.predictions.filter(
    (prediction) =>
      prediction.labelId !== NO_FINDING_ID &&
      prediction.probability >= displayThreshold
  ).length
  const noFinding = result.predictions.find(
    (prediction) => prediction.labelId === NO_FINDING_ID
  )
  const topPathology = result.predictions.reduce<InferencePrediction | null>(
    (current, prediction) => {
      if (prediction.labelId === NO_FINDING_ID) return current
      return !current || prediction.probability > current.probability
        ? prediction
        : current
    },
    null
  )
  const noFindingDominates =
    noFinding !== undefined &&
    (!topPathology || noFinding.probability > topPathology.probability)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-balance">
          Model evidence
        </h2>
        <span className="text-right text-xs text-muted-foreground tabular-nums">
          {activeCount} visible · {result.predictions.length} returned
        </span>
      </div>

      {noFindingDominates && noFinding ? (
        <NoFindingRow prediction={noFinding} />
      ) : null}

      <div className="flex flex-col gap-1.5">
        {result.predictions
          .filter(
            (prediction) =>
              !(noFindingDominates && prediction.labelId === NO_FINDING_ID)
          )
          .map((prediction) => (
            <PredictionRow
              key={prediction.key}
              prediction={prediction}
              result={result}
              displayThreshold={displayThreshold}
              isActive={activePredictionKey === prediction.key}
              onFocusPrediction={onFocusPrediction}
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
  displayThreshold,
  isActive,
  onFocusPrediction,
  onOpenPrototypeGallery,
}: {
  prediction: InferencePrediction
  result: InferenceResult
  displayThreshold: number
  isActive: boolean
  onFocusPrediction: (key: string | null) => void
  onOpenPrototypeGallery: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const label =
    prediction.labelId === null ? null : LABELS_BY_ID[prediction.labelId]
  const isNoFinding = prediction.labelId === NO_FINDING_ID
  const isVisible = prediction.probability >= displayThreshold
  const topPrototypes = result.prototypes
    .filter((prototype) => prototype.predictionKey === prediction.key)
    .slice(0, 3)
  const color = label?.color ?? "oklch(0.7 0.03 240)"

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group/row rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10 transition-[box-shadow,opacity] duration-150 ease-out",
          isActive && "ring-2 ring-foreground/40",
          !isVisible && !isNoFinding && "opacity-55"
        )}
      >
        <div className="flex min-h-10 items-center gap-2">
          <button
            type="button"
            onClick={() => onFocusPrediction(isActive ? null : prediction.key)}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md text-left transition-transform duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96]"
            aria-label={`Focus ${prediction.label} explanation`}
            aria-pressed={isActive}
            disabled={isNoFinding}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {prediction.label}
            </span>
            <DecisionBadge predicted={prediction.predicted} />
            <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums group-hover/row:text-foreground">
              {(prediction.probability * 100).toFixed(1)}%
            </span>
          </button>
          {!isNoFinding ? (
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={open ? "Collapse evidence" : "Expand evidence"}
                  className="-mr-2 size-10"
                />
              }
            >
              <ChevronDownIcon
                className={cn(
                  "transition-transform duration-200 ease-out",
                  open && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
          ) : null}
        </div>

        <ProbabilityBar
          value={prediction.probability}
          displayThreshold={displayThreshold}
          modelThreshold={result.modelThreshold}
          color={color}
          className="mt-1.5"
        />

        {!isNoFinding ? (
          <CollapsibleContent className="overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0">
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <EvidenceSection title="Model reasoning">
                <p className="text-xs leading-relaxed text-pretty text-foreground/85">
                  {prediction.reasoning ??
                    "No model reasoning was returned for this prediction."}
                </p>
              </EvidenceSection>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/35 p-2.5 text-[11px]">
                <Metric
                  label="Model decision"
                  value={decisionText(prediction.predicted)}
                />
                <Metric
                  label="Model cutoff"
                  value={result.modelThreshold.toFixed(2)}
                />
                <Metric
                  label="Threshold margin"
                  value={
                    prediction.thresholdMargin === null
                      ? "Not returned"
                      : `${prediction.thresholdMargin >= 0 ? "+" : ""}${prediction.thresholdMargin.toFixed(3)}`
                  }
                />
                <Metric
                  label="Borderline"
                  value={
                    prediction.thresholdBorderline === null
                      ? "Not returned"
                      : prediction.thresholdBorderline
                        ? "Yes"
                        : "No"
                  }
                  warning={prediction.thresholdBorderline === true}
                />
              </div>

              <EvidenceSection title="Clinical context">
                <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                  {label?.clinicalNote ??
                    "No curated clinical context is available for this backend class."}
                </p>
              </EvidenceSection>

              {topPrototypes.length > 0 ? (
                <EvidenceSection title="Backend prototypes">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      Source-first previews
                    </span>
                    <Button
                      variant="link"
                      size="xs"
                      onClick={() => onOpenPrototypeGallery(prediction.key)}
                      className="min-h-10 p-0 text-xs"
                    >
                      Inspect evidence
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {topPrototypes.map((prototype) => (
                      <div
                        key={prototype.prototypeId}
                        className="flex w-20 flex-col gap-1"
                      >
                        <div className="aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10">
                          <PrototypePreview prototype={prototype} />
                        </div>
                        <div className="flex items-center justify-between px-0.5 text-[10px] text-muted-foreground tabular-nums">
                          <span>
                            {prototype.similarity === null
                              ? "—"
                              : `${(prototype.similarity * 100).toFixed(1)}%`}
                          </span>
                          <span>
                            {prototype.sourceImageUrl &&
                            prototype.activationMapUrl
                              ? "OVR"
                              : prototype.sourceImageUrl
                                ? "SRC"
                                : "ACT"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </EvidenceSection>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-muted/35 p-2.5 text-[11px] text-muted-foreground">
                  <SparklesIcon className="mt-0.5 size-3.5 shrink-0" />
                  No prototype evidence was returned for this prediction.
                </div>
              )}
            </div>
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  )
}

function PrototypePreview({ prototype }: { prototype: PrototypeMatch }) {
  const showOverlay =
    prototype.sourceImageUrl !== null && prototype.activationMapUrl !== null

  return (
    <div className="relative size-full">
      <ExplanationImage
        src={prototype.sourceImageUrl ?? prototype.activationMapUrl}
        alt={`Prototype ${prototype.prototypeId}`}
        unavailableText="Source unavailable"
      />
      {showOverlay ? (
        <img
          src={prototype.activationMapUrl!}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-fill opacity-75 mix-blend-screen contrast-125 saturate-150"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

function EvidenceSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-medium text-foreground tabular-nums",
          warning && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DecisionBadge({ predicted }: { predicted: boolean | null }) {
  if (predicted === null) return null
  return (
    <Badge
      variant={predicted ? "default" : "outline"}
      className="hidden h-5 px-1.5 text-[9px] sm:inline-flex"
    >
      {predicted ? "Detected" : "Not detected"}
    </Badge>
  )
}

function decisionText(predicted: boolean | null) {
  if (predicted === null) return "Not returned"
  return predicted ? "Detected" : "Not detected"
}

function NoFindingRow({ prediction }: { prediction: InferencePrediction }) {
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
          aria-hidden="true"
        >
          <path d="M3 7.5 L6 10.5 L11 4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{prediction.label}</p>
        <p className="text-[11px] text-pretty text-emerald-800/70 dark:text-emerald-200/70">
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
  displayThreshold,
  modelThreshold,
  color,
  className,
}: {
  value: number
  displayThreshold: number
  modelThreshold: number
  color: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-visible rounded-full bg-muted",
        className
      )}
      aria-label={`Probability ${(value * 100).toFixed(1)}%, model cutoff ${(modelThreshold * 100).toFixed(0)}%, display threshold ${(displayThreshold * 100).toFixed(0)}%`}
    >
      <div
        className="h-full rounded-full transition-[width,opacity] duration-500 ease-out"
        style={{
          width: `${Math.min(100, Math.max(2, value * 100))}%`,
          backgroundColor: color,
          opacity: value >= displayThreshold ? 1 : 0.5,
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/75"
        style={{ left: `${modelThreshold * 100}%` }}
        title="Model cutoff"
        aria-hidden="true"
      />
      {Math.abs(displayThreshold - modelThreshold) > 0.001 ? (
        <div
          className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 border-l border-dashed border-foreground/35"
          style={{ left: `${displayThreshold * 100}%` }}
          title="Display threshold"
          aria-hidden="true"
        />
      ) : null}
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
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
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
