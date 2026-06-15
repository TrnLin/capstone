import {
  LABELS,
  LABELS_BY_ID,
  NO_FINDING_ID,
  type AnatomicalBlob,
} from "./labels"
import { hash32, type InferenceResult, type Prediction } from "./mock-api"
import type {
  BackendModelPrediction,
  BackendPredictionResponse,
  BackendPrototype,
} from "./backend-api"

type NormalizeOptions = {
  fallbackImageId?: string
  fallbackFilename?: string
}

type OccurrenceBlob = AnatomicalBlob & {
  intensity: number
}

const CLASS_TO_LABEL_ID = new Map<string, number>(
  [
    ["aortic enlargement", 0],
    ["atelectasis", 1],
    ["calcification", 2],
    ["cardiomegaly", 3],
    ["consolidation", 4],
    ["ild", 5],
    ["interstitial lung disease", 5],
    ["infiltration", 6],
    ["lung opacity", 7],
    ["opacity", 7],
    ["lung lesion", 8],
    ["nodule mass", 8],
    ["nodule/mass", 8],
    ["mass", 8],
    ["nodule", 8],
    ["other lesion", 9],
    ["pleural effusion", 10],
    ["effusion", 10],
    ["pleural thickening", 11],
    ["pneumothorax", 12],
    ["pulmonary fibrosis", 13],
    ["fibrosis", 13],
    ["no finding", 14],
    ["no findings", 14],
    ["normal", 14],
  ].map(([name, id]) => [normalizeClassName(String(name)), Number(id)])
)

export function normalizeBackendPredictionResponse(
  payload: BackendPredictionResponse,
  opts: NormalizeOptions = {}
): InferenceResult {
  const byId = new Map<number, BackendModelPrediction>()
  for (const prediction of payload.predictions ?? []) {
    const labelId = labelIdForPrediction(prediction)
    if (labelId === null) continue
    const current = byId.get(labelId)
    if (!current || probabilityOf(prediction) > probabilityOf(current)) {
      byId.set(labelId, prediction)
    }
  }

  const threshold = typeof payload.threshold === "number" ? payload.threshold : 0.5
  const predictions = LABELS.map<Prediction>((label) => {
    const backendPrediction = byId.get(label.id)
    const probability = round(probabilityOf(backendPrediction), 3)
    const prediction: Prediction = {
      labelId: label.id,
      label: label.name,
      probability,
    }
    if (
      label.id !== NO_FINDING_ID &&
      label.hasBbox &&
      probability >= threshold &&
      label.candidateBlobs[0]
    ) {
      prediction.bbox = bboxFromBlob(label.candidateBlobs[0])
    }
    return prediction
  }).sort((a, b) => b.probability - a.probability)

  return {
    imageId:
      payload.backend?.image_id ??
      opts.fallbackImageId ??
      payload.filename ??
      opts.fallbackFilename ??
      "backend-image",
    predictions,
    occurrenceMaps: buildOccurrenceMaps(predictions, threshold),
    prototypes: buildPrototypes(payload.predictions ?? []),
    modelVersion: modelVersion(payload),
    inferenceMs: Math.round(
      payload.backend?.duration_ms ??
        payload.timings_ms?.total ??
        payload.timings_ms?.response_assembly ??
        0
    ),
  }
}

function labelIdForPrediction(prediction: BackendModelPrediction) {
  const className = prediction.class_name ?? prediction.label
  if (!className) return null
  return CLASS_TO_LABEL_ID.get(normalizeClassName(className)) ?? null
}

function normalizeClassName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s/]/g, "")
    .replace(/\s+/g, " ")
}

function probabilityOf(prediction: BackendModelPrediction | undefined) {
  const probability = prediction?.probability
  return typeof probability === "number" && Number.isFinite(probability)
    ? Math.max(0, Math.min(1, probability))
    : 0.02
}

function bboxFromBlob(blob: AnatomicalBlob): [number, number, number, number] {
  const pad = 0.02
  return [
    round(Math.max(0, blob.cx - blob.rx - pad), 3),
    round(Math.max(0, blob.cy - blob.ry - pad), 3),
    round(Math.min(1, blob.rx * 2 + pad * 2), 3),
    round(Math.min(1, blob.ry * 2 + pad * 2), 3),
  ]
}

function buildOccurrenceMaps(
  predictions: Prediction[],
  threshold: number
): Record<number, OccurrenceBlob[]> {
  const out: Record<number, OccurrenceBlob[]> = {}
  for (const prediction of predictions) {
    if (prediction.labelId === NO_FINDING_ID) continue
    if (prediction.probability < Math.min(0.35, threshold)) continue
    const label = LABELS_BY_ID[prediction.labelId]
    if (!label || label.candidateBlobs.length === 0) continue
    out[prediction.labelId] = label.candidateBlobs.map((blob, idx) => ({
      ...blob,
      intensity: round(Math.min(0.95, 0.55 + prediction.probability * 0.35 - idx * 0.06), 3),
    }))
  }
  return out
}

function buildPrototypes(predictions: BackendModelPrediction[]): InferenceResult["prototypes"] {
  const out: InferenceResult["prototypes"] = []
  for (const prediction of predictions) {
    const labelId = labelIdForPrediction(prediction)
    if (labelId === null || labelId === NO_FINDING_ID) continue
    for (const [rank, prototype] of (prediction.prototypes ?? []).entries()) {
      out.push({
        labelId,
        prototypeId: prototypeId(labelId, rank, prototype),
        similarity: round(similarityOf(prototype), 3),
        sourceDataset: "Backend",
        thumbnailSeed: hash32(
          `${labelId}:${rank}:${prototype.prototype_idx ?? ""}:${prototype.source_image_path ?? ""}`
        ),
      })
    }
  }
  return out
}

function prototypeId(labelId: number, rank: number, prototype: BackendPrototype) {
  if (prototype.prototype_idx !== undefined && prototype.prototype_idx !== null) {
    return `proto-${prototype.prototype_idx}`
  }
  if (prototype.source_image_id) return `proto-${prototype.source_image_id}`
  return `proto-${labelId}-${rank + 1}`
}

function similarityOf(prototype: BackendPrototype) {
  if (typeof prototype.similarity === "number" && Number.isFinite(prototype.similarity)) {
    return Math.max(0, Math.min(1, prototype.similarity))
  }
  if (
    typeof prototype.source_distance === "number" &&
    Number.isFinite(prototype.source_distance)
  ) {
    return Math.max(0, Math.min(1, 1 - prototype.source_distance))
  }
  return 0
}

function modelVersion(payload: BackendPredictionResponse) {
  const modelVersion = payload.model_version
  if (typeof modelVersion === "string" && modelVersion) return modelVersion
  return "backend:model"
}

function round(n: number, digits = 3) {
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}
