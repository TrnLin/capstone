import { mulberry32 } from "~/lib/mock-api"
import { LABELS_BY_ID } from "~/lib/labels"
import { cn } from "~/lib/utils"

type PrototypeThumbnailProps = {
  seed: number
  labelId: number
  className?: string
}

/**
 * A deterministic, compact visualisation representing a learned prototype
 * patch. Produces a small, tile-friendly motif in the colour of its label,
 * re-created identically for a given seed.
 */
export function PrototypeThumbnail({
  seed,
  labelId,
  className,
}: PrototypeThumbnailProps) {
  const color = LABELS_BY_ID[labelId]?.color ?? "oklch(0.7 0.14 220)"
  const rand = mulberry32(seed >>> 0)
  const blobs = Array.from({ length: 5 + Math.floor(rand() * 3) }, () => ({
    cx: 15 + rand() * 70,
    cy: 15 + rand() * 70,
    r: 6 + rand() * 22,
    o: 0.25 + rand() * 0.5,
  }))

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn(
        "size-full rounded-lg ring-1 ring-foreground/10",
        className
      )}
    >
      <defs>
        <radialGradient id={`pbg-${seed}`} cx="50%" cy="45%" r="80%">
          <stop offset="0%" stopColor="oklch(0.24 0.01 240)" />
          <stop offset="100%" stopColor="oklch(0.08 0.01 240)" />
        </radialGradient>
        <radialGradient id={`pblob-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#pbg-${seed})`} />
      <g style={{ mixBlendMode: "screen" }}>
        {blobs.map((b, i) => (
          <circle
            key={i}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill={`url(#pblob-${seed})`}
            opacity={b.o}
          />
        ))}
      </g>
    </svg>
  )
}
