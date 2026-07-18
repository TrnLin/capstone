import { LABELS_BY_ID } from "./labels"
import type {
  InferencePrediction,
  InferenceResult,
  PrototypeMatch,
} from "./inference"
import type {
  BackendModelPrediction,
  BackendPredictionResponse,
  BackendPrototype,
} from "./backend-api"

type NormalizeOptions = {
  fallbackImageId?: string
  fallbackFilename?: string
  resolveApiUrl?: (path: string) => string
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
  const rawThreshold = finiteNumber(payload.threshold)
  const threshold = rawThreshold === null ? 0.5 : clamp01(rawThreshold)
  const warnings: string[] = []
  const predictions = (payload.predictions ?? []).flatMap<InferencePrediction>(
    (prediction) => {
      const className = prediction.class_name ?? prediction.label
      const probability = finiteNumber(prediction.probability)
      if (!className || probability === null) {
        warnings.push(
          "Skipped a prediction without a class name or finite probability."
        )
        return []
      }
      const labelId = labelIdForPrediction(prediction)
      return [
        {
          key: predictionKey(className),
          labelId,
          label:
            labelId === null
              ? className
              : (LABELS_BY_ID[labelId]?.name ?? className),
          probability: round(clamp01(probability), 3),
          predicted:
            typeof prediction.predicted === "boolean"
              ? prediction.predicted
              : null,
          thresholdMargin: finiteNumber(prediction.threshold_margin),
          thresholdBorderline:
            typeof prediction.threshold_borderline === "boolean"
              ? prediction.threshold_borderline
              : null,
          reasoning:
            typeof prediction.reasoning === "string" &&
            prediction.reasoning.trim()
              ? prediction.reasoning.trim()
              : null,
          occurrenceMapUrl: explanationImageUrl(
            prediction.occurrence_map_base64,
            warnings,
            `${className} occurrence map`
          ),
        },
      ]
    }
  )

  return {
    imageId:
      payload.backend?.image_id ??
      opts.fallbackImageId ??
      payload.filename ??
      opts.fallbackFilename ??
      "backend-image",
    filename: typeof payload.filename === "string" ? payload.filename : null,
    predictions,
    prototypes: buildPrototypes(payload.predictions ?? [], opts, warnings),
    modelThreshold: threshold,
    modelVersion: modelVersion(payload),
    inferenceMs: Math.round(
      payload.backend?.duration_ms ??
        payload.timings_ms?.total ??
        payload.timings_ms?.response_assembly ??
        0
    ),
    timingsMs: numericTimingEntries(payload.timings_ms),
    explanationSource: "backend",
    backend: {
      imageId: stringOrNull(payload.backend?.image_id),
      predictionId: stringOrNull(payload.backend?.prediction_id),
      durationMs: finiteNumber(payload.backend?.duration_ms),
    },
    sanitizedResponse: sanitizeBackendResponse(payload),
    normalizationWarnings: warnings,
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

function buildPrototypes(
  predictions: BackendModelPrediction[],
  opts: NormalizeOptions,
  warnings: string[]
): PrototypeMatch[] {
  const out: PrototypeMatch[] = []
  for (const prediction of predictions) {
    const className = prediction.class_name ?? prediction.label
    if (!className) continue
    const labelId = labelIdForPrediction(prediction)
    for (const [rank, prototype] of (prediction.prototypes ?? []).entries()) {
      out.push({
        predictionKey: predictionKey(className),
        labelId,
        prototypeId: prototypeId(labelId, rank, prototype),
        similarity: similarityOf(prototype),
        sourceDistance: finiteNumber(prototype.source_distance),
        sourceImageUrl: resolveSourceImageUrl(
          prototype.source_image_url,
          opts,
          warnings,
          `${className} prototype source image`
        ),
        sourceImageId: stringOrNull(prototype.source_image_id),
        sourceFilename: sourceFilename(prototype.source_image_path),
        patchHeight: finiteNumber(prototype.source_patch_h),
        patchWidth: finiteNumber(prototype.source_patch_w),
        activationMapUrl: explanationImageUrl(
          prototype.heatmap_base64,
          warnings,
          `${className} prototype activation`
        ),
      })
    }
  }
  return out
}

function prototypeId(
  labelId: number | null,
  rank: number,
  prototype: BackendPrototype
) {
  if (
    prototype.prototype_idx !== undefined &&
    prototype.prototype_idx !== null
  ) {
    return `proto-${prototype.prototype_idx}`
  }
  if (prototype.source_image_id) return `proto-${prototype.source_image_id}`
  return `proto-${labelId}-${rank + 1}`
}

function similarityOf(prototype: BackendPrototype): number | null {
  if (
    typeof prototype.similarity === "number" &&
    Number.isFinite(prototype.similarity)
  ) {
    return Math.max(0, Math.min(1, prototype.similarity))
  }
  if (
    typeof prototype.source_distance === "number" &&
    Number.isFinite(prototype.source_distance)
  ) {
    return Math.max(0, Math.min(1, 1 - prototype.source_distance))
  }
  return null
}

function predictionKey(name: string) {
  return normalizeClassName(name).replace(/[\s/]+/g, "-") || "prediction"
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null
}

function rasterDataUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const dataUrlMatch = trimmed.match(
    /^data:image\/(png|jpe?g|webp);base64,(.+)$/i
  )
  if (dataUrlMatch) {
    return isBase64Payload(dataUrlMatch[2]) ? trimmed : null
  }
  if (trimmed.startsWith("data:")) return null
  const compact = trimmed.replace(/\s+/g, "")
  if (!isBase64Payload(compact)) return null
  const mime = compact.startsWith("/9j/")
    ? "image/jpeg"
    : compact.startsWith("UklGR")
      ? "image/webp"
      : "image/png"
  return `data:${mime};base64,${compact}`
}

function isBase64Payload(value: string) {
  const compact = value.replace(/\s+/g, "")
  return /^[a-z0-9+/]+={0,2}$/i.test(compact) && compact.length % 4 !== 1
}

function explanationImageUrl(
  value: unknown,
  warnings: string[],
  description: string
) {
  const imageUrl = rasterDataUrl(value)
  if (value !== null && value !== undefined && value !== "" && !imageUrl) {
    warnings.push(`Ignored an invalid ${description}.`)
  }
  return imageUrl
}

function resolveSourceImageUrl(
  value: unknown,
  opts: NormalizeOptions,
  warnings: string[],
  description: string
) {
  if (typeof value !== "string" || !value.trim()) return null
  const url = value.trim()
  if (/^https?:/i.test(url)) return url
  if (url.startsWith("data:")) {
    const imageUrl = rasterDataUrl(url)
    if (!imageUrl) warnings.push(`Ignored an invalid ${description}.`)
    return imageUrl
  }
  const resolved = opts.resolveApiUrl?.(url) ?? null
  if (!resolved) warnings.push(`Could not resolve the ${description} URL.`)
  return resolved
}

function sourceFilename(value: unknown) {
  if (typeof value !== "string" || !value) return null
  return value.split(/[\\/]/).pop() || null
}

function numericTimingEntries(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  )
}

function sanitizeBackendResponse(value: unknown, key?: string): unknown {
  if (
    typeof value === "string" &&
    (key === "occurrence_map_base64" || key === "heatmap_base64")
  ) {
    return `[base64 image omitted: ${value.length} chars]`
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeBackendResponse(item))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeBackendResponse(entryValue, entryKey),
      ])
    )
  }
  return value
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
