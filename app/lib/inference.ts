export type ExplanationSource = "backend" | "demo"

export type InferencePrediction = {
  key: string
  labelId: number | null
  label: string
  probability: number
  predicted: boolean | null
  thresholdMargin: number | null
  thresholdBorderline: boolean | null
  reasoning: string | null
  occurrenceMapUrl: string | null
}

export type PrototypeMatch = {
  predictionKey: string
  labelId: number | null
  prototypeId: string
  similarity: number | null
  sourceDistance: number | null
  sourceImageUrl: string | null
  sourcePatchUrl: string | null
  sourceImageId: string | null
  sourceFilename: string | null
  patchHeight: number | null
  patchWidth: number | null
  sourceGridHeight: number | null
  sourceGridWidth: number | null
  activationMapUrl: string | null
}

export type BackendMetadata = {
  imageId: string | null
  predictionId: string | null
  durationMs: number | null
}

export type InferenceResult = {
  imageId: string
  filename: string | null
  predictions: InferencePrediction[]
  prototypes: PrototypeMatch[]
  modelThreshold: number
  modelVersion: string
  inferenceMs: number
  timingsMs: Record<string, number>
  explanationSource: ExplanationSource
  backend: BackendMetadata
  sanitizedResponse: unknown
  normalizationWarnings: string[]
}
