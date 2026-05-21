/**
 * Curated sample CXRs used on the demo page. Each entry has a human-readable
 * title, caption, the SVG image path, and a pre-baked `InferenceResult`.
 *
 * Pre-baked results are used for the three built-in samples so the demo
 * always lands on visually compelling predictions — randomized-by-hash
 * results are reserved for images the user uploads.
 */

import type { InferenceResult } from "./mock-api"
import { LABELS, LABELS_BY_ID, NO_FINDING_ID } from "./labels"

export type Sample = {
  id: string
  title: string
  caption: string
  imageUrl: string
  /** Used as a stable `size` when seeding future deterministic reruns. */
  size: number
  bakedResult: InferenceResult
}

// ---------- helpers ----------

function bakedPredictions(active: Array<[number, number]>): InferenceResult["predictions"] {
  const map = new Map<number, number>(active)
  return LABELS.map((l) => {
    const probability = map.get(l.id) ?? 0.02 + ((l.id * 13) % 9) / 100
    const p: InferenceResult["predictions"][number] = {
      labelId: l.id,
      label: l.name,
      probability: Math.round(probability * 1000) / 1000,
    }
    if (l.hasBbox && probability >= 0.5 && l.candidateBlobs[0]) {
      const b = l.candidateBlobs[0]
      p.bbox = [
        Math.max(0, Math.round((b.cx - b.rx - 0.02) * 1000) / 1000),
        Math.max(0, Math.round((b.cy - b.ry - 0.02) * 1000) / 1000),
        Math.min(1, Math.round((b.rx * 2 + 0.04) * 1000) / 1000),
        Math.min(1, Math.round((b.ry * 2 + 0.04) * 1000) / 1000),
      ]
    }
    return p
  }).sort((a, b) => b.probability - a.probability)
}

function bakedOccurrenceMaps(
  active: readonly number[]
): InferenceResult["occurrenceMaps"] {
  const out: InferenceResult["occurrenceMaps"] = {}
  for (const id of active) {
    if (id === NO_FINDING_ID) continue
    const l = LABELS_BY_ID[id]!
    out[id] = l.candidateBlobs.map((b, i) => ({
      cx: b.cx,
      cy: b.cy,
      rx: b.rx,
      ry: b.ry,
      intensity: Math.max(0.55, 0.88 - i * 0.1),
    }))
  }
  return out
}

function bakedPrototypes(
  active: Array<[number, number]>
): InferenceResult["prototypes"] {
  const datasets = ["VinDr-CXR", "NIH", "CheXpert", "PadChest"] as const
  const out: InferenceResult["prototypes"] = []
  for (const [labelId, probability] of active) {
    if (labelId === NO_FINDING_ID) continue
    for (let i = 0; i < 3; i++) {
      out.push({
        labelId,
        prototypeId: `proto-${labelId}-${1000 + labelId * 7 + i}`,
        similarity: Math.max(0.4, Math.min(0.97, probability - i * 0.06)),
        sourceDataset: datasets[(labelId + i) % datasets.length]!,
        thumbnailSeed: labelId * 104729 + i * 7919,
      })
    }
  }
  return out
}

function bakeResult(opts: {
  imageId: string
  active: Array<[number, number]>
  inferenceMs: number
}): InferenceResult {
  const predictions = bakedPredictions(opts.active)
  const activeIds = opts.active.map(([id]) => id)
  return {
    imageId: opts.imageId,
    predictions,
    occurrenceMaps: bakedOccurrenceMaps(activeIds),
    prototypes: bakedPrototypes(opts.active),
    modelVersion: "xprotonet-muck-0.1.0-mock",
    inferenceMs: opts.inferenceMs,
  }
}

// ---------- samples ----------

export const SAMPLES: readonly Sample[] = [
  {
    id: "sample-normal",
    title: "Normal study",
    caption:
      "Real VinDr-CXR study labelled \u201CNo finding\u201D by three radiologists. The model should land back on no-finding.",
    imageUrl: "/samples/cxr/0a0b773c653cea6653a1e02faf1566a5.png",
    size: 482_131,
    bakedResult: bakeResult({
      imageId: "sample-normal",
      active: [[NO_FINDING_ID, 0.91]],
      inferenceMs: 612,
    }),
  },
  {
    id: "sample-cardiomegaly",
    title: "Cardiomegaly",
    caption:
      "Real VinDr-CXR study. Predictions on this page are simulated for the demo \u2014 the actual VinDr label for this image is \u201CNo finding\u201D.",
    imageUrl: "/samples/cxr/0a1addecfc432a1b425d61fe57bc29d2.png",
    size: 531_902,
    bakedResult: bakeResult({
      imageId: "sample-cardiomegaly",
      active: [
        [3, 0.93],
        [0, 0.58],
      ],
      inferenceMs: 744,
    }),
  },
  {
    id: "sample-effusion",
    title: "Pleural effusion + opacity",
    caption:
      "Real VinDr-CXR study. Predictions on this page are simulated for the demo \u2014 the actual VinDr label for this image is \u201CNo finding\u201D.",
    imageUrl: "/samples/cxr/0a0b773c653cea6653a1e02faf1566a5.png",
    size: 568_204,
    bakedResult: bakeResult({
      imageId: "sample-effusion",
      active: [
        [10, 0.89],
        [7, 0.74],
        [4, 0.56],
      ],
      inferenceMs: 821,
    }),
  },
] as const

export const SAMPLES_BY_ID: Record<string, Sample> = Object.fromEntries(
  SAMPLES.map((s) => [s.id, s])
)
