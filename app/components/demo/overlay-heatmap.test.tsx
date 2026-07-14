import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { InferenceResult } from "~/lib/inference"

import { HeatmapOverlay } from "./overlay-heatmap"

function resultWithMap(occurrenceMapUrl: string | null): InferenceResult {
  return {
    imageId: "image-1",
    filename: "study.png",
    modelThreshold: 0.5,
    modelVersion: "model-1",
    inferenceMs: 100,
    timingsMs: {},
    explanationSource: "backend",
    backend: {
      imageId: "image-1",
      predictionId: "prediction-1",
      durationMs: 100,
    },
    sanitizedResponse: {},
    normalizationWarnings: [],
    prototypes: [],
    predictions: [
      {
        key: "cardiomegaly",
        labelId: 3,
        label: "Cardiomegaly",
        probability: 0.8,
        predicted: true,
        thresholdMargin: 0.3,
        thresholdBorderline: false,
        reasoning: null,
        occurrenceMapUrl,
      },
    ],
  }
}

describe("HeatmapOverlay", () => {
  it("renders the backend occurrence-map image", () => {
    const markup = renderToStaticMarkup(
      <HeatmapOverlay
        result={resultWithMap("data:image/png;base64,AAAA")}
        displayThreshold={0.5}
        opacity={0.65}
        activePredictionKey={null}
      />
    )

    expect(markup).toContain('src="data:image/png;base64,AAAA"')
    expect(markup).toContain("Loading occurrence map")
  })

  it("renders an explicit unavailable state instead of a synthetic fallback", () => {
    const markup = renderToStaticMarkup(
      <HeatmapOverlay
        result={resultWithMap(null)}
        displayThreshold={0.5}
        opacity={0.65}
        activePredictionKey="cardiomegaly"
      />
    )

    expect(markup).toContain("No occurrence map was returned for Cardiomegaly")
    expect(markup).not.toContain("radialGradient")
  })
})
