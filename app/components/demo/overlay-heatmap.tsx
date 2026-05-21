import { LABELS_BY_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/mock-api"

type HeatmapOverlayProps = {
  result: InferenceResult
  threshold: number
  opacity: number
  activeLabelId: number | null
}

export function HeatmapOverlay({
  result,
  threshold,
  opacity,
  activeLabelId,
}: HeatmapOverlayProps) {
  const entries = Object.entries(result.occurrenceMaps)
    .map(([id, blobs]) => ({ id: Number(id), blobs }))
    .filter(({ id }) => {
      const pred = result.predictions.find((p) => p.labelId === id)
      return pred && pred.probability >= threshold
    })
  const filtered =
    activeLabelId !== null
      ? entries.filter((e) => e.id === activeLabelId)
      : entries

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: "screen", opacity }}
      aria-hidden="true"
    >
      <defs>
        {filtered.map(({ id, blobs }) => {
          const color = LABELS_BY_ID[id]?.color ?? "oklch(0.8 0.15 200)"
          return blobs.map((blob, i) => (
            <radialGradient
              id={`blob-${id}-${i}`}
              key={`grad-${id}-${i}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={color} stopOpacity={blob.intensity} />
              <stop
                offset="55%"
                stopColor={color}
                stopOpacity={blob.intensity * 0.45}
              />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          ))
        })}
      </defs>
      {filtered.map(({ id, blobs }) =>
        blobs.map((blob, i) => (
          <ellipse
            key={`ellipse-${id}-${i}`}
            cx={blob.cx * 100}
            cy={blob.cy * 100}
            rx={blob.rx * 100 * 1.6}
            ry={blob.ry * 100 * 1.6}
            fill={`url(#blob-${id}-${i})`}
          />
        ))
      )}
    </svg>
  )
}
