import { describe, expect, it } from "vitest"

import {
  getExplanationAvailability,
  selectOccurrenceMap,
} from "./explainability"
import type { InferenceResult } from "./inference"

const result: InferenceResult = {
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
      key: "top-without-map",
      labelId: null,
      label: "Top without map",
      probability: 0.92,
      predicted: true,
      thresholdMargin: 0.42,
      thresholdBorderline: false,
      reasoning: null,
      occurrenceMapUrl: null,
    },
    {
      key: "highest-explained",
      labelId: null,
      label: "Highest explained",
      probability: 0.81,
      predicted: true,
      thresholdMargin: 0.31,
      thresholdBorderline: false,
      reasoning: null,
      occurrenceMapUrl: "data:image/png;base64,AAAA",
    },
    {
      key: "lower-explained",
      labelId: null,
      label: "Lower explained",
      probability: 0.63,
      predicted: true,
      thresholdMargin: 0.13,
      thresholdBorderline: false,
      reasoning: null,
      occurrenceMapUrl: "data:image/png;base64,BBBB",
    },
  ],
}

describe("selectOccurrenceMap", () => {
  it("selects the highest-probability available map above the display threshold", () => {
    expect(selectOccurrenceMap(result, 0.7, null)).toMatchObject({
      status: "available",
      predictionKey: "highest-explained",
      imageUrl: "data:image/png;base64,AAAA",
    })
  })

  it("does not substitute another map when the focused prediction has no map", () => {
    expect(selectOccurrenceMap(result, 0.5, "top-without-map")).toEqual({
      status: "unavailable",
      predictionKey: "top-without-map",
      label: "Top without map",
      imageUrl: null,
    })
  })

  it("reports which backend explanation layers are actually available", () => {
    expect(getExplanationAvailability(result)).toEqual({
      occurrenceMaps: true,
      prototypes: false,
      boundingBoxes: false,
    })
  })
})
