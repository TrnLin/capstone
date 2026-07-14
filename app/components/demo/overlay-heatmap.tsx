import { LABELS_BY_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/mock-api"

type HeatmapOverlayProps = {
  result: InferenceResult
  threshold: number
  opacity: number
  activeLabelId: number | null
}

const FALLBACK_COLOR = "oklch(0.8 0.15 200)"

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
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        {filtered.map(({ id, blobs }) => {
          const color = LABELS_BY_ID[id]?.color ?? FALLBACK_COLOR
          return blobs.map((blob, i) => (
            <radialGradient
              id={`blob-${id}-${i}`}
              key={`grad-${id}-${i}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop
                offset="0%"
                stopColor={color}
                stopOpacity={blob.intensity * 0.95}
              />
              <stop
                offset="45%"
                stopColor={color}
                stopOpacity={blob.intensity * 0.6}
              />
              <stop
                offset="75%"
                stopColor={color}
                stopOpacity={blob.intensity * 0.25}
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
      {/* Core contours on top of every fill so overlapping blobs stay
          locatable; the dark casing keeps the ring visible over bright bone
          where the tinted fill alone would wash out. */}
      {filtered.map(({ id, blobs }) => {
        const color = LABELS_BY_ID[id]?.color ?? FALLBACK_COLOR
        return blobs.map((blob, i) => (
          <g key={`contour-${id}-${i}`}>
            <ellipse
              cx={blob.cx * 100}
              cy={blob.cy * 100}
              rx={blob.rx * 100}
              ry={blob.ry * 100}
              fill="none"
              stroke="oklch(0 0 0)"
              strokeOpacity={0.45}
              strokeWidth={3.5}
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx={blob.cx * 100}
              cy={blob.cy * 100}
              rx={blob.rx * 100}
              ry={blob.ry * 100}
              fill="none"
              stroke={color}
              strokeOpacity={0.9}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))
      })}
    </svg>
  )
}
