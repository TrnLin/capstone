import { describe, expect, it } from "vitest"

import {
  getExplanationAvailability,
  initialDisplayThreshold,
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

  it("does not auto-select a no-finding occurrence map", () => {
    expect(
      selectOccurrenceMap(
        {
          ...result,
          predictions: [
            {
              ...result.predictions[0]!,
              key: "no-finding",
              labelId: 14,
              label: "No finding",
              probability: 0.99,
              occurrenceMapUrl: "data:image/png;base64,NONE",
            },
            ...result.predictions,
          ],
        },
        0.5,
        null
      )
    ).toMatchObject({
      predictionKey: "highest-explained",
      imageUrl: "data:image/png;base64,AAAA",
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

describe("initialDisplayThreshold", () => {
  it("drops to the strongest pathology when every pathology is below the model cutoff", () => {
    expect(
      initialDisplayThreshold({
        ...result,
        predictions: [
          {
            ...result.predictions[0]!,
            labelId: 14,
            probability: 0.91,
          },
          {
            ...result.predictions[1]!,
            probability: 0.274,
          },
          {
            ...result.predictions[2]!,
            probability: 0.24,
          },
          {
            ...result.predictions[0]!,
            key: "higher-without-evidence",
            probability: 0.4,
          },
        ],
      })
    ).toBe(0.274)
  })

  it("keeps the model cutoff when a pathology reaches it", () => {
    expect(initialDisplayThreshold(result)).toBe(0.5)
  })
})
