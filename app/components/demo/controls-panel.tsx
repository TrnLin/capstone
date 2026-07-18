import { useState } from "react"
import {
  BoxIcon,
  ChevronDownIcon,
  EyeOffIcon,
  LayersIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SplitSquareVerticalIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Slider } from "~/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { cn } from "~/lib/utils"
import { LABELS_BY_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/inference"
import { getExplanationAvailability } from "~/lib/explainability"

import type { OverlayMode } from "./types"

type ControlsPanelProps = {
  result: InferenceResult | null
  overlayMode: OverlayMode
  onOverlayModeChange: (mode: OverlayMode) => void
  displayThreshold: number
  onDisplayThresholdChange: (v: number) => void
  heatmapOpacity: number
  onHeatmapOpacityChange: (v: number) => void
  compare: boolean
  onCompareChange: (v: boolean) => void
  activePredictionKey: string | null
  onClearActive: () => void
  disabled?: boolean
  className?: string
}

export function ControlsPanel({
  result,
  overlayMode,
  onOverlayModeChange,
  displayThreshold,
  onDisplayThresholdChange,
  heatmapOpacity,
  onHeatmapOpacityChange,
  compare,
  onCompareChange,
  activePredictionKey,
  onClearActive,
  disabled = false,
  className,
}: ControlsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const availability = getExplanationAvailability(result)
  const hasOccurrenceMaps = availability.occurrenceMaps
  const hasPrototypes = availability.prototypes
  const canCompare = overlayMode === "heatmap" && hasOccurrenceMaps
  const focusedPrediction =
    activePredictionKey !== null
      ? (result?.predictions.find(
          (prediction) => prediction.key === activePredictionKey
        ) ?? null)
      : null
  const focusedLabel =
    focusedPrediction?.labelId !== null &&
    focusedPrediction?.labelId !== undefined
      ? LABELS_BY_ID[focusedPrediction.labelId]
      : null

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
        disabled && "pointer-events-none opacity-60",
        className
      )}
      aria-label="Visualization controls"
    >
      <header className="flex items-center gap-2">
        <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Controls
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand controls" : "Collapse controls"}
          className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </button>
      </header>
      <div
        className={cn(
          "flex flex-col gap-4",
          // Collapsed only applies on mobile; lg+ always shows everything.
          collapsed && "hidden lg:flex"
        )}
      >
        <div className="space-y-2">
          <Label>Overlay</Label>
          <ToggleGroup
            orientation="horizontal"
            value={[overlayMode]}
            onValueChange={(arr) => {
              const list = Array.isArray(arr) ? arr : [arr]
              const next = list[list.length - 1]
              if (typeof next === "string" && next) {
                onOverlayModeChange(next as OverlayMode)
              }
            }}
            aria-label="Overlay mode"
            className="grid w-full grid-cols-2 gap-1"
          >
            <ToggleGroupItem
              value="heatmap"
              aria-label="Heatmap overlay"
              disabled={!hasOccurrenceMaps}
            >
              <LayersIcon data-icon="inline-start" />
              Heatmap
            </ToggleGroupItem>
            <ToggleGroupItem
              value="boxes"
              aria-label="Bounding boxes unavailable"
              disabled
              title="The backend does not return bounding-box coordinates."
            >
              <BoxIcon data-icon="inline-start" />
              Boxes
            </ToggleGroupItem>
            <ToggleGroupItem
              value="prototypes"
              aria-label="Prototypes overlay"
              disabled={!hasPrototypes}
            >
              <SparklesIcon data-icon="inline-start" />
              Prototypes
            </ToggleGroupItem>
            <ToggleGroupItem value="off" aria-label="Overlays off">
              <EyeOffIcon data-icon="inline-start" />
              Off
            </ToggleGroupItem>
          </ToggleGroup>
          {result && (!hasOccurrenceMaps || !hasPrototypes) && (
            <p className="text-[10px] leading-tight text-pretty text-muted-foreground">
              {!hasOccurrenceMaps ? "No occurrence maps returned. " : ""}
              {!hasPrototypes ? "No prototype evidence returned. " : ""}
              Bounding boxes are not part of the backend response.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="threshold-slider">Display threshold</Label>
            <span className="text-xs text-foreground tabular-nums">
              {displayThreshold.toFixed(2)}
            </span>
          </div>
          <Slider
            id="threshold-slider"
            min={0}
            max={1}
            step={0.01}
            value={[displayThreshold]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0]! : (v as number)
              onDisplayThresholdChange(n)
            }}
            aria-label="Display threshold"
          />
          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span>Filters visible explanations only</span>
            <span className="shrink-0 tabular-nums">
              model cutoff {result?.modelThreshold.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "space-y-2 transition-opacity",
            overlayMode === "heatmap"
              ? "opacity-100"
              : "pointer-events-none opacity-40"
          )}
          aria-hidden={overlayMode !== "heatmap"}
        >
          <div className="flex items-baseline justify-between">
            <Label htmlFor="opacity-slider">Heatmap opacity</Label>
            <span className="text-xs text-foreground tabular-nums">
              {heatmapOpacity.toFixed(2)}
            </span>
          </div>
          <Slider
            id="opacity-slider"
            min={0}
            max={1}
            step={0.01}
            value={[heatmapOpacity]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0]! : (v as number)
              onHeatmapOpacityChange(n)
            }}
            aria-label="Heatmap opacity"
          />
        </div>

        <div className="space-y-2">
          <Label>Compare</Label>
          <Button
            variant={compare ? "default" : "outline"}
            size="sm"
            onClick={() => onCompareChange(!compare)}
            disabled={!canCompare}
            aria-pressed={compare}
            className="w-full justify-center"
          >
            <SplitSquareVerticalIcon />
            {compare ? "Comparing side-by-side" : "Side-by-side"}
          </Button>
          {!canCompare && (
            <p className="text-[10px] leading-tight text-muted-foreground">
              Compare requires an available occurrence-map overlay.
            </p>
          )}
        </div>

        {focusedPrediction && (
          <div className="space-y-1.5 rounded-xl border border-border bg-background/40 p-2.5">
            <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Focused label
            </div>
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: focusedLabel?.color ?? "oklch(0.7 0.03 240)",
                }}
                aria-hidden
              />
              <Badge
                variant="outline"
                className="truncate"
                title={focusedPrediction.label}
              >
                {focusedLabel?.shortName ?? focusedPrediction.label}
              </Badge>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClearActive}
                aria-label="Clear focused label"
                className="ml-auto"
              >
                <XIcon />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
    >
      {children}
    </label>
  )
}
