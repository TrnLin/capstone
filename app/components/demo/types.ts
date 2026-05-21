import type { InferenceResult } from "~/lib/mock-api"

export type LoadedImage = {
  source:
    | { kind: "sample"; id: string }
    | { kind: "file"; file: File }
  displayName: string
  imageUrl: string
  isDicom: boolean
}

export type HistoryItem = LoadedImage & {
  id: string
  addedAt: number
  cachedResult: InferenceResult | null
}

export type OverlayMode = "heatmap" | "boxes" | "prototypes" | "off"

export type DemoStatus = "idle" | "loading" | "ready" | "error"

export type DemoState = {
  image: LoadedImage | null
  result: InferenceResult | null
  status: DemoStatus
  error: string | null
  overlayMode: OverlayMode
  threshold: number
  heatmapOpacity: number
  activeLabelId: number | null
  compare: boolean
}
