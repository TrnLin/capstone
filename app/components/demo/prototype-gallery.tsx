import { useEffect, useState } from "react"
import { ImageOffIcon, LayersIcon, SparklesIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Separator } from "~/components/ui/separator"
import type { InferenceResult, PrototypeMatch } from "~/lib/inference"
import { LABELS_BY_ID } from "~/lib/labels"
import { cn } from "~/lib/utils"

import { ExplanationImage } from "./explanation-image"

type PrototypeGalleryProps = {
  result: InferenceResult | null
  predictionKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type EvidenceMode = "source" | "activation" | "overlay"

export function PrototypeGallery({
  result,
  predictionKey,
  open,
  onOpenChange,
}: PrototypeGalleryProps) {
  const prediction = result?.predictions.find(
    (candidate) => candidate.key === predictionKey
  )
  const label =
    prediction?.labelId === null || prediction?.labelId === undefined
      ? null
      : LABELS_BY_ID[prediction.labelId]
  const prototypes =
    result && predictionKey
      ? result.prototypes.filter(
          (prototype) => prototype.predictionKey === predictionKey
        )
      : []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<EvidenceMode>("source")
  const selected =
    prototypes.find((prototype) => prototype.prototypeId === selectedId) ??
    prototypes[0] ??
    null

  useEffect(() => {
    setSelectedId(prototypes[0]?.prototypeId ?? null)
    setMode(prototypes[0]?.sourceImageUrl ? "source" : "activation")
  }, [open, predictionKey, prototypes[0]?.prototypeId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-balance">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: label?.color ?? "oklch(0.7 0.03 240)" }}
            />
            Prototype evidence · {prediction?.label ?? "Prediction"}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Inspect the backend-provided training source and activation map for
            each matched prototype. These are model explanations, not
            independent clinical findings.
          </DialogDescription>
        </DialogHeader>
        <Separator />

        {selected ? (
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Returned prototypes
              </div>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-2">
                {prototypes.map((prototype, index) => (
                  <button
                    key={prototype.prototypeId}
                    type="button"
                    onClick={() => {
                      setSelectedId(prototype.prototypeId)
                      setMode(
                        prototype.sourceImageUrl ? "source" : "activation"
                      )
                    }}
                    className={cn(
                      "min-h-10 rounded-xl bg-muted/35 p-1.5 text-left ring-1 ring-foreground/10 transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.96]",
                      selected.prototypeId === prototype.prototypeId &&
                        "ring-2 ring-foreground/45"
                    )}
                    aria-pressed={
                      selected.prototypeId === prototype.prototypeId
                    }
                    aria-label={`Inspect prototype ${index + 1}`}
                  >
                    <div className="aspect-square overflow-hidden rounded-lg">
                      <ExplanationImage
                        src={
                          prototype.sourceImageUrl ?? prototype.activationMapUrl
                        }
                        alt={`Prototype ${index + 1}`}
                        unavailableText="No image"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1 px-0.5 text-[9px] text-muted-foreground tabular-nums">
                      <span>#{index + 1}</span>
                      <span>
                        {prototype.similarity === null
                          ? "—"
                          : `${(prototype.similarity * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className="flex rounded-lg bg-muted/50 p-1"
                  role="group"
                  aria-label="Evidence view"
                >
                  <ModeButton
                    active={mode === "source"}
                    disabled={!selected.sourceImageUrl}
                    onClick={() => setMode("source")}
                  >
                    Source
                  </ModeButton>
                  <ModeButton
                    active={mode === "activation"}
                    disabled={!selected.activationMapUrl}
                    onClick={() => setMode("activation")}
                  >
                    Activation
                  </ModeButton>
                  <ModeButton
                    active={mode === "overlay"}
                    disabled={
                      !selected.sourceImageUrl || !selected.activationMapUrl
                    }
                    onClick={() => setMode("overlay")}
                  >
                    <LayersIcon className="size-3" />
                    Overlay
                  </ModeButton>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {selected.prototypeId}
                </Badge>
              </div>

              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-black/10 dark:ring-white/10">
                <PrototypeEvidence prototype={selected} mode={mode} />
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/35 p-3 text-[11px] sm:grid-cols-3">
                <Metadata
                  label="Similarity"
                  value={
                    selected.similarity === null
                      ? "Not returned"
                      : `${(selected.similarity * 100).toFixed(1)}%`
                  }
                />
                <Metadata
                  label="Source distance"
                  value={
                    selected.sourceDistance === null
                      ? "Not returned"
                      : selected.sourceDistance.toFixed(4)
                  }
                />
                <Metadata
                  label="Patch dimensions"
                  value={
                    selected.patchWidth === null ||
                    selected.patchHeight === null
                      ? "Not returned"
                      : `${selected.patchWidth} × ${selected.patchHeight}`
                  }
                />
                <Metadata
                  label="Source file"
                  value={selected.sourceFilename ?? "Not returned"}
                />
                <Metadata
                  label="Source ID"
                  value={selected.sourceImageId ?? "Not returned"}
                />
                <Metadata
                  label="Activation"
                  value={
                    selected.activationMapUrl ? "Available" : "Not returned"
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-xl bg-muted/35 p-6 text-center text-sm text-muted-foreground">
            <div className="flex max-w-xs flex-col items-center gap-2">
              <SparklesIcon className="size-5 opacity-60" />
              No prototype evidence was returned for this prediction.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PrototypeEvidence({
  prototype,
  mode,
}: {
  prototype: PrototypeMatch
  mode: EvidenceMode
}) {
  if (mode === "source") {
    return (
      <ExplanationImage
        src={prototype.sourceImageUrl}
        alt={`Training source for ${prototype.prototypeId}`}
        unavailableText="Source image was not returned"
        imageClassName="object-contain"
      />
    )
  }
  if (mode === "activation") {
    return (
      <ExplanationImage
        src={prototype.activationMapUrl}
        alt={`Activation map for ${prototype.prototypeId}`}
        unavailableText="Activation map was not returned"
        imageClassName="object-contain"
      />
    )
  }
  if (!prototype.sourceImageUrl || !prototype.activationMapUrl) {
    return (
      <div className="grid size-full place-items-center text-center text-xs text-white/70">
        <div className="flex flex-col items-center gap-2">
          <ImageOffIcon className="size-5" />
          Source and activation are both required for overlay mode.
        </div>
      </div>
    )
  }
  return (
    <div className="relative size-full">
      <ExplanationImage
        src={prototype.sourceImageUrl}
        alt={`Training source with activation for ${prototype.prototypeId}`}
        unavailableText="Source image was not returned"
        imageClassName="object-contain"
      />
      <ActivationOverlayLayer src={prototype.activationMapUrl} />
    </div>
  )
}

function ActivationOverlayLayer({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (failed) {
    return (
      <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
        <ImageOffIcon className="size-3" />
        Activation could not be displayed
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="pointer-events-none absolute inset-0 size-full object-fill opacity-65 mix-blend-screen outline -outline-offset-1 outline-black/10 dark:outline-white/10"
      aria-hidden="true"
    />
  )
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-[scale,background-color,color] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground"
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-muted-foreground">{label}</div>
      <div
        className="truncate font-medium text-foreground tabular-nums"
        title={value}
      >
        {value}
      </div>
    </div>
  )
}
