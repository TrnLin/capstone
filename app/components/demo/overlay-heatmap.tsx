import { useEffect, useRef, useState } from "react"
import { AlertTriangleIcon, ImageOffIcon, LoaderCircleIcon } from "lucide-react"

import { selectOccurrenceMap } from "~/lib/explainability"
import type { InferenceResult } from "~/lib/inference"

type HeatmapOverlayProps = {
  result: InferenceResult
  displayThreshold: number
  opacity: number
  activePredictionKey: string | null
}

export function HeatmapOverlay({
  result,
  displayThreshold,
  opacity,
  activePredictionKey,
}: HeatmapOverlayProps) {
  const selection = selectOccurrenceMap(
    result,
    displayThreshold,
    activePredictionKey
  )
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    selection.imageUrl ? "loading" : "ready"
  )
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!selection.imageUrl) {
      setImageState("ready")
      return
    }

    const image = imageRef.current
    setImageState(
      image?.complete ? (image.naturalWidth > 0 ? "ready" : "error") : "loading"
    )
  }, [selection.imageUrl])

  if (selection.status !== "available" || !selection.imageUrl) {
    const belowThreshold = selection.status === "below-threshold"
    return (
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
        <div className="flex max-w-xs items-start gap-2 rounded-xl bg-black/70 px-3 py-2.5 text-xs text-white/85 shadow-lg backdrop-blur-sm">
          {belowThreshold ? (
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          ) : (
            <ImageOffIcon className="mt-0.5 size-3.5 shrink-0 text-white/60" />
          )}
          <span className="text-pretty">
            {belowThreshold
              ? `${selection.label ?? "This prediction"} is below the display threshold.`
              : selection.label
                ? `No occurrence map was returned for ${selection.label}.`
                : "No occurrence maps were returned by the backend."}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <img
        ref={imageRef}
        src={selection.imageUrl}
        alt=""
        onLoad={() => setImageState("ready")}
        onError={() => setImageState("error")}
        className="absolute inset-0 size-full object-fill transition-opacity duration-200 ease-out"
        style={{ opacity: imageState === "ready" ? opacity : 0 }}
        aria-hidden="true"
      />
      {imageState === "loading" ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-sm">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            Loading occurrence map…
          </span>
        </div>
      ) : null}
      {imageState === "error" ? (
        <div className="absolute inset-0 grid place-items-center p-6">
          <span className="flex max-w-xs items-center gap-2 rounded-xl bg-black/70 px-3 py-2 text-xs text-white/85 backdrop-blur-sm">
            <ImageOffIcon className="size-3.5 shrink-0" />
            The occurrence-map image could not be displayed.
          </span>
        </div>
      ) : null}
      {imageState === "ready" ? (
        <span className="absolute bottom-3 left-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white/90 shadow-sm backdrop-blur-sm">
          Occurrence map · {selection.label}
        </span>
      ) : null}
    </div>
  )
}
