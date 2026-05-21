import { useEffect, useRef, useState } from "react"
import { SparklesIcon, SplitSquareVerticalIcon, XIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"
import { LABELS_BY_ID, NO_FINDING_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/mock-api"

import { BoxOverlay } from "./overlay-boxes"
import { HeatmapOverlay } from "./overlay-heatmap"
import { PrototypeThumbnail } from "./prototype-thumbnail"
import type { LoadedImage, OverlayMode } from "./types"

type ViewerProps = {
  image: LoadedImage
  result: InferenceResult | null
  loading: boolean
  overlayMode: OverlayMode
  threshold: number
  heatmapOpacity: number
  activeLabelId: number | null
  onClearActive: () => void
  compare: boolean
  className?: string
}

export function Viewer({
  image,
  result,
  loading,
  overlayMode,
  threshold,
  heatmapOpacity,
  activeLabelId,
  onClearActive,
  compare,
  className,
}: ViewerProps) {
  const [aspect, setAspect] = useState(3 / 4)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setAspect(3 / 4)
  }, [image.imageUrl])

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[oklch(0.145_0_0)] ring-1 ring-foreground/10",
        className
      )}
    >
      {image.isDicom && (
        <Badge
          variant="outline"
          className="absolute top-3 left-3 z-10 border-amber-400/40 bg-black/60 text-amber-200 backdrop-blur-sm"
        >
          DICOM stand-in
        </Badge>
      )}

      {activeLabelId !== null && (
        <div className="absolute top-3 right-3 z-10">
          <Button
            size="xs"
            variant="outline"
            onClick={onClearActive}
            className="border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
          >
            <XIcon />
            Clear focus
          </Button>
        </div>
      )}

      <div
        className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center"
      >
        <div
          className="relative w-full max-h-full"
          style={{ aspectRatio: aspect }}
        >
          <img
            ref={imgRef}
            src={image.imageUrl}
            alt={image.displayName}
            onLoad={(e) => {
              const el = e.currentTarget
              if (el.naturalWidth && el.naturalHeight) {
                setAspect(el.naturalWidth / el.naturalHeight)
              }
            }}
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full object-contain select-none",
              "transition-opacity duration-300",
              loading && "opacity-70"
            )}
          />

          {result && (overlayMode === "heatmap" || overlayMode === "boxes") && (
            <CompareClip compare={compare}>
              {overlayMode === "heatmap" && (
                <HeatmapOverlay
                  result={result}
                  threshold={threshold}
                  opacity={heatmapOpacity}
                  activeLabelId={activeLabelId}
                />
              )}
              {overlayMode === "boxes" && (
                <BoxOverlay
                  result={result}
                  threshold={threshold}
                  activeLabelId={activeLabelId}
                />
              )}
            </CompareClip>
          )}

          {result && overlayMode === "prototypes" && (
            <PrototypeOverlay
              result={result}
              threshold={threshold}
              activeLabelId={activeLabelId}
            />
          )}

          {loading && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                Running prototype inference…
              </div>
            </div>
          )}
        </div>
      </div>

      <ViewerCaption image={image} result={result} loading={loading} />
    </div>
  )
}

function CompareClip({
  compare,
  children,
}: {
  compare: boolean
  children: React.ReactNode
}) {
  const [split, setSplit] = useState(0.5)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (!compare) setSplit(0.5)
  }, [compare])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      const next = Math.min(
        0.98,
        Math.max(0.02, (e.clientX - rect.left) / rect.width)
      )
      setSplit(next)
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  if (!compare) {
    return <>{children}</>
  }

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
      >
        {children}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(split * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault()
          dragging.current = true
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSplit((s) => Math.max(0.02, s - 0.02))
          if (e.key === "ArrowRight") setSplit((s) => Math.min(0.98, s + 0.02))
        }}
        className="absolute top-0 bottom-0 z-20 -translate-x-1/2 cursor-col-resize"
        style={{ left: `${split * 100}%` }}
      >
        <div className="pointer-events-none h-full w-px bg-white/80 shadow-[0_0_12px_rgba(0,0,0,0.5)]" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-lg">
          <SplitSquareVerticalIcon className="size-3.5" />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
        Explained
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
        Original
      </div>
    </div>
  )
}

function PrototypeOverlay({
  result,
  threshold,
  activeLabelId,
}: {
  result: InferenceResult
  threshold: number
  activeLabelId: number | null
}) {
  const top = result.predictions.find(
    (p) => p.labelId !== NO_FINDING_ID && p.probability >= threshold
  )
  const focusId = activeLabelId ?? top?.labelId ?? null
  if (focusId === null) return null

  const protos = result.prototypes
    .filter((p) => p.labelId === focusId)
    .slice(0, 3)
  if (protos.length === 0) return null

  const label = LABELS_BY_ID[focusId]

  return (
    <div className="absolute top-4 left-4 flex max-w-[min(60%,360px)] flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-sm">
        <SparklesIcon className="size-3" />
        Nearest prototypes · {label?.shortName ?? "label"}
      </div>
      <div className="flex items-stretch gap-2">
        {protos.map((p) => (
          <div
            key={p.prototypeId}
            className="flex w-28 flex-col gap-1 rounded-xl bg-black/55 p-1.5 ring-1 ring-white/15 backdrop-blur-sm"
          >
            <div className="aspect-square w-full overflow-hidden rounded-lg">
              <PrototypeThumbnail seed={p.thumbnailSeed} labelId={p.labelId} />
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-white/90">
              <span className="tabular-nums">
                {Math.round(p.similarity * 100)}%
              </span>
              <span className="uppercase tracking-wide text-white/60">
                {p.sourceDataset}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ViewerCaption({
  image,
  result,
  loading,
}: {
  image: LoadedImage
  result: InferenceResult | null
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-4 py-2 text-xs text-white/80 backdrop-blur-sm">
      <span className="truncate font-medium">{image.displayName}</span>
      <div className="flex items-center gap-3 text-white/60 tabular-nums">
        {loading ? (
          <Skeleton className="h-3 w-28 bg-white/15" />
        ) : result ? (
          <>
            <span>{result.modelVersion}</span>
            <span>·</span>
            <span>{result.inferenceMs} ms</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
