/**
 * Deterministic, client-side mock of the eventual `/api/predict` endpoint.
 *
 * The same file (by name + size) always produces the same result — this is
 * what makes the demo feel like a real, reproducible model rather than a
 * random generator. The shape of `InferenceResult` is deliberately aligned
 * with the planned FastAPI contract so the UI does not need to change when
 * a real XProtoNet backend is wired in.
 */

import {
  LABELS,
  LABELS_BY_ID,
  NO_FINDING_ID,
  PATHOLOGY_IDS,
  type AnatomicalBlob,
} from "./labels"

export type SourceDataset =
  | "NIH"
  | "CheXpert"
  | "VinDr-CXR"
  | "PadChest"
  | "Backend"

export type OccurrenceBlob = AnatomicalBlob & {
  /** relative intensity in [0, 1] */
  intensity: number
}

export type Prediction = {
  labelId: number
  label: string
  probability: number
  /** Normalized bounding box [x, y, width, height] in [0,1] image space. */
  bbox?: [number, number, number, number]
}

export type PrototypeMatch = {
  labelId: number
  prototypeId: string
  similarity: number
  sourceDataset: SourceDataset
  /** Deterministic seed used to render a per-prototype thumbnail. */
  thumbnailSeed: number
}

export type InferenceResult = {
  imageId: string
  predictions: Prediction[]
  occurrenceMaps: Record<number, OccurrenceBlob[]>
  prototypes: PrototypeMatch[]
  modelVersion: string
  inferenceMs: number
}

export type InferenceInput =
  | { kind: "file"; file: File }
  | { kind: "sample"; id: string; size: number }

const SOURCES: readonly SourceDataset[] = [
  "VinDr-CXR",
  "NIH",
  "CheXpert",
  "PadChest",
] as const

const MODEL_VERSION = "xprotonet-muck-0.1.0-mock"

// ---------- seeded PRNG ----------

/** FNV-1a 32-bit hash; tiny and deterministic. */
function hash32(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG — returns a function producing values in [0, 1). */
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!
}

function round(n: number, digits = 3): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

// ---------- result construction ----------

function buildPredictions(rand: () => number): Prediction[] {
  // Roughly a third of images in VinDr-CXR are "No finding" — bias to that.
  const hasPathology = rand() < 0.72

  // Baseline probabilities for each label: low noise.
  const probs = new Map<number, number>()
  for (const l of LABELS) {
    probs.set(l.id, 0.02 + rand() * 0.14)
  }

  if (hasPathology) {
    // Activate 1–3 pathologies deterministically.
    const count = 1 + Math.floor(rand() * 3)
    const chosen = new Set<number>()
    while (chosen.size < count) chosen.add(pick(rand, PATHOLOGY_IDS))
    for (const id of chosen) {
      probs.set(id, 0.55 + rand() * 0.4)
    }
    probs.set(NO_FINDING_ID, 0.05 + rand() * 0.1)
  } else {
    probs.set(NO_FINDING_ID, 0.78 + rand() * 0.18)
  }

  return LABELS.map((l) => {
    const probability = round(probs.get(l.id) ?? 0, 3)
    const predicted: Prediction = {
      labelId: l.id,
      label: l.name,
      probability,
    }
    if (l.hasBbox && probability >= 0.5 && l.candidateBlobs.length > 0) {
      const blob = pick(rand, l.candidateBlobs)
      const pad = 0.015 + rand() * 0.02
      predicted.bbox = [
        round(Math.max(0, blob.cx - blob.rx - pad), 3),
        round(Math.max(0, blob.cy - blob.ry - pad), 3),
        round(Math.min(1, blob.rx * 2 + pad * 2), 3),
        round(Math.min(1, blob.ry * 2 + pad * 2), 3),
      ]
    }
    return predicted
  }).sort((a, b) => b.probability - a.probability)
}

function buildOccurrenceMaps(
  rand: () => number,
  predictions: Prediction[]
): Record<number, OccurrenceBlob[]> {
  const out: Record<number, OccurrenceBlob[]> = {}
  for (const p of predictions) {
    if (p.labelId === NO_FINDING_ID) continue
    if (p.probability < 0.35) continue
    const label = LABELS_BY_ID[p.labelId]!
    const candidates = label.candidateBlobs
    if (candidates.length === 0) continue

    // Bilateral pathologies get two blobs; focal ones get one.
    const blobCount = candidates.length > 1 && rand() < 0.7 ? 2 : 1
    const picks = new Set<number>()
    while (picks.size < Math.min(blobCount, candidates.length)) {
      picks.add(Math.floor(rand() * candidates.length))
    }
    out[p.labelId] = Array.from(picks).map((idx) => {
      const base = candidates[idx]!
      return {
        cx: round(base.cx + (rand() - 0.5) * 0.03, 3),
        cy: round(base.cy + (rand() - 0.5) * 0.03, 3),
        rx: round(base.rx * (0.85 + rand() * 0.3), 3),
        ry: round(base.ry * (0.85 + rand() * 0.3), 3),
        intensity: round(0.55 + p.probability * 0.4 + rand() * 0.05, 3),
      }
    })
  }
  return out
}

function buildPrototypes(
  rand: () => number,
  predictions: Prediction[]
): PrototypeMatch[] {
  const active = predictions
    .filter((p) => p.labelId !== NO_FINDING_ID && p.probability >= 0.35)
    .slice(0, 4)

  const out: PrototypeMatch[] = []
  for (const p of active) {
    const perLabel = 3
    for (let i = 0; i < perLabel; i++) {
      out.push({
        labelId: p.labelId,
        prototypeId: `proto-${p.labelId}-${Math.floor(rand() * 9999)
          .toString()
          .padStart(4, "0")}`,
        similarity: round(
          Math.max(0.4, Math.min(0.97, p.probability - i * 0.06 + rand() * 0.03)),
          3
        ),
        sourceDataset: pick(rand, SOURCES),
        thumbnailSeed: Math.floor(rand() * 2 ** 31),
      })
    }
  }
  return out
}

// ---------- public API ----------

function seedFromInput(input: InferenceInput): { seed: number; imageId: string } {
  if (input.kind === "sample") {
    const key = `sample:${input.id}:${input.size}`
    return { seed: hash32(key), imageId: input.id }
  }
  const key = `file:${input.file.name}:${input.file.size}:${input.file.lastModified}`
  return {
    seed: hash32(key),
    imageId: `${input.file.name}-${input.file.size}`,
  }
}

/**
 * Produces a deterministic `InferenceResult` from either an uploaded File or
 * a referenced sample. Adds a small artificial latency so the UI's loading
 * states have time to render.
 */
export async function mockInfer(input: InferenceInput): Promise<InferenceResult> {
  const { seed, imageId } = seedFromInput(input)
  const rand = mulberry32(seed)
  const latency = 420 + Math.floor(rand() * 780)

  const predictions = buildPredictions(rand)
  const occurrenceMaps = buildOccurrenceMaps(rand, predictions)
  const prototypes = buildPrototypes(rand, predictions)

  await new Promise<void>((resolve) => setTimeout(resolve, latency))

  return {
    imageId,
    predictions,
    occurrenceMaps,
    prototypes,
    modelVersion: MODEL_VERSION,
    inferenceMs: latency,
  }
}

export { hash32, mulberry32 }
