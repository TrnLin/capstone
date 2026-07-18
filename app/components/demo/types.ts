import type { InferenceResult } from "~/lib/inference"

export type LoadedImage = {
  source:
    | { kind: "sample"; id: string }
    | { kind: "file"; file: File }
    | { kind: "remote"; imageId: string; predictionId: string }
  displayName: string
  imageUrl: string
  isDicom: boolean
}

export type HistoryItem = LoadedImage & {
  id: string
  addedAt: number
  cachedResult: InferenceResult | null
  backendJobId?: string
  backendPredictionId?: string | null
  backendImageId?: string
  jobStatus?: string
  errorMessage?: string | null
  revokeImageUrl?: boolean
}

export type OverlayMode = "heatmap" | "boxes" | "prototypes" | "off"

export type DemoStatus = "idle" | "loading" | "ready" | "error"

export type DemoState = {
  image: LoadedImage | null
  result: InferenceResult | null
  status: DemoStatus
  error: string | null
  overlayMode: OverlayMode
  displayThreshold: number
  heatmapOpacity: number
  activePredictionKey: string | null
  compare: boolean
}
