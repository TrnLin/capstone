import { describe, expect, it } from "vitest"

import { normalizeBackendPredictionResponse } from "./backend-adapter"

describe("normalizeBackendPredictionResponse", () => {
  it("maps backend model predictions into the existing UI inference shape", () => {
    const result = normalizeBackendPredictionResponse({
      filename: "study.png",
      threshold: 0.5,
      predictions: [
        {
          class_name: "Cardiomegaly",
          probability: 0.64,
          predicted: true,
          prototypes: [
            {
              prototype_idx: 30,
              similarity: 0.91,
              source_image_path: "source-cardio.png",
            },
          ],
        },
        {
          class_name: "Pleural Effusion",
          probability: 0.42,
          predicted: false,
          prototypes: [
            {
              prototype_idx: 100,
              similarity: 0.82,
              source_image_url: "/api/prototype-source/signed",
            },
          ],
        },
        {
          class_name: "No Finding",
          probability: 0.48,
          predicted: false,
          prototypes: [],
        },
      ],
      backend: {
        image_id: "image-123",
        prediction_id: "prediction-456",
        duration_ms: 321,
      },
    })

    expect(result.imageId).toBe("image-123")
    expect(result.modelVersion).toBe("backend:model")
    expect(result.inferenceMs).toBe(321)
    expect(result.predictions).toHaveLength(15)
    expect(result.predictions[0]).toMatchObject({
      labelId: 3,
      label: "Cardiomegaly",
      probability: 0.64,
    })
    expect(result.predictions.find((p) => p.labelId === 10)).toMatchObject({
      label: "Pleural effusion",
      probability: 0.42,
    })
    expect(result.predictions.find((p) => p.labelId === 14)).toMatchObject({
      label: "No finding",
      probability: 0.48,
    })
    expect(result.occurrenceMaps[3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ intensity: expect.any(Number) }),
      ])
    )
    expect(result.prototypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labelId: 3,
          prototypeId: "proto-30",
          similarity: 0.91,
          sourceDataset: "Backend",
        }),
      ])
    )
  })
})
