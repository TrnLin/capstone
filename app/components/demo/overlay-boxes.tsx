import { LABELS_BY_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/mock-api"

type BoxOverlayProps = {
  result: InferenceResult
  threshold: number
  activeLabelId: number | null
}

export function BoxOverlay({
  result,
  threshold,
  activeLabelId,
}: BoxOverlayProps) {
  const boxed = result.predictions.filter(
    (p) => p.bbox && p.probability >= threshold
  )
  const filtered =
    activeLabelId !== null
      ? boxed.filter((p) => p.labelId === activeLabelId)
      : boxed

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {filtered.map((p) => {
        const [x, y, w, h] = p.bbox!
        const color = LABELS_BY_ID[p.labelId]?.color ?? "#f0f"
        return (
          <g key={p.labelId}>
            <rect
              x={x * 100}
              y={y * 100}
              width={w * 100}
              height={h * 100}
              fill="none"
              stroke={color}
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1.2 0.8"
              opacity={0.95}
              rx={0.4}
            />
            <rect
              x={x * 100 + 0.4}
              y={y * 100 - 3.6}
              width={Math.max(18, p.label.length * 1.6) + 6}
              height={3.2}
              fill={color}
              rx={0.8}
              opacity={0.95}
            />
            <text
              x={x * 100 + 1.2}
              y={y * 100 - 1.3}
              fontSize={2.1}
              fontFamily="inherit"
              fontWeight={600}
              fill="#fff"
              style={{ paintOrder: "stroke" }}
            >
              {p.label} · {Math.round(p.probability * 100)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
