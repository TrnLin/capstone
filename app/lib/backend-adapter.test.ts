import { describe, expect, it } from "vitest"

import { normalizeBackendPredictionResponse } from "./backend-adapter"

describe("normalizeBackendPredictionResponse", () => {
  it("preserves backend predictions and their real occurrence maps without fabricating labels", () => {
    const result = normalizeBackendPredictionResponse({
      threshold: 0.5,
      predictions: [
        {
          class_name: "Cardiomegaly",
          probability: 0.64,
          predicted: true,
          occurrence_map_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
        },
        {
          class_name: "Unmapped model class",
          probability: 0.31,
          predicted: false,
        },
      ],
    })

    expect(result.predictions).toHaveLength(2)
    expect(result.predictions[0]).toMatchObject({
      key: "cardiomegaly",
      labelId: 3,
      predicted: true,
      occurrenceMapUrl: expect.stringMatching(/^data:image\/png;base64,/),
    })
    expect(result.predictions[1]).toMatchObject({
      key: "unmapped-model-class",
      labelId: null,
      label: "Unmapped model class",
      occurrenceMapUrl: null,
    })
  })

  it("keeps a backend-shaped debug response without embedding base64 image bodies", () => {
    const occurrenceMap = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
    const prototypeMap = "/9j/4AAQSkZJRgABAQAAAQABAAD"
    const result = normalizeBackendPredictionResponse({
      predictions: [
        {
          class_name: "Cardiomegaly",
          probability: 0.64,
          occurrence_map_base64: occurrenceMap,
          prototypes: [{ heatmap_base64: prototypeMap }],
        },
      ],
    })

    expect(result.sanitizedResponse).toMatchObject({
      predictions: [
        {
          occurrence_map_base64: `[base64 image omitted: ${occurrenceMap.length} chars]`,
          prototypes: [
            {
              heatmap_base64: `[base64 image omitted: ${prototypeMap.length} chars]`,
            },
          ],
        },
      ],
    })
  })

  it("rejects malformed or unsupported explanation image values", () => {
    const result = normalizeBackendPredictionResponse({
      predictions: [
        {
          class_name: "Cardiomegaly",
          probability: 0.64,
          occurrence_map_base64: "data:image/png;base64,%%%",
          prototypes: [
            {
              heatmap_base64: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
              source_image_url: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
            },
          ],
        },
      ],
    })

    expect(result.predictions[0]?.occurrenceMapUrl).toBeNull()
    expect(result.prototypes[0]?.activationMapUrl).toBeNull()
    expect(result.prototypes[0]?.sourceImageUrl).toBeNull()
    expect(result.normalizationWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("occurrence map"),
        expect.stringContaining("prototype activation"),
        expect.stringContaining("prototype source image"),
      ])
    )
  })

  it("maps model decisions, prototype provenance, and timing metadata", () => {
    const result = normalizeBackendPredictionResponse(
      {
        filename: "study.png",
        model_version: "xprotonet-2",
        threshold: 0.5,
        predictions: [
          {
            class_name: "Cardiomegaly",
            probability: 0.64,
            predicted: true,
            threshold_margin: 0.14,
            threshold_borderline: true,
            reasoning: "The cardiac silhouette matches positive prototypes.",
            prototypes: [
              {
                prototype_idx: 30,
                similarity: 0.91,
                heatmap_base64: "/9j/4AAQSkZJRgABAQAAAQABAAD",
                source_image_path: "/dataset/source-cardio.png",
                source_image_id: "source-30",
                source_image_url: "/api/prototype-source/signed",
                source_patch_h: 48,
                source_patch_w: 64,
                source_distance: 0.09,
              },
            ],
          },
          {
            class_name: "Pleural Effusion",
            probability: 0.42,
            predicted: false,
            prototypes: [],
          },
          {
            class_name: "No Finding",
            probability: 0.48,
            predicted: false,
            prototypes: [],
          },
        ],
        timings_ms: {
          preprocess: 11.5,
          explainability_forward: 44.25,
          heatmap_rendering: 8,
          total: 75,
        },
        backend: {
          image_id: "image-123",
          prediction_id: "prediction-456",
          duration_ms: 321,
        },
      },
      { resolveApiUrl: (path) => `http://api.test${path}` }
    )

    expect(result.imageId).toBe("image-123")
    expect(result.filename).toBe("study.png")
    expect(result.modelVersion).toBe("xprotonet-2")
    expect(result.modelThreshold).toBe(0.5)
    expect(result.inferenceMs).toBe(321)
    expect(result.timingsMs).toEqual({
      preprocess: 11.5,
      explainability_forward: 44.25,
      heatmap_rendering: 8,
      total: 75,
    })
    expect(result.predictions).toHaveLength(3)
    expect(result.predictions[0]).toMatchObject({
      labelId: 3,
      label: "Cardiomegaly",
      probability: 0.64,
      predicted: true,
      thresholdMargin: 0.14,
      thresholdBorderline: true,
      reasoning: "The cardiac silhouette matches positive prototypes.",
    })
    expect(result.predictions.find((p) => p.labelId === 10)).toMatchObject({
      label: "Pleural effusion",
      probability: 0.42,
    })
    expect(result.predictions.find((p) => p.labelId === 14)).toMatchObject({
      label: "No finding",
      probability: 0.48,
    })
    expect(result.prototypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predictionKey: "cardiomegaly",
          labelId: 3,
          prototypeId: "proto-30",
          similarity: 0.91,
          sourceDistance: 0.09,
          sourceImageUrl: "http://api.test/api/prototype-source/signed",
          sourceImageId: "source-30",
          sourceFilename: "source-cardio.png",
          patchHeight: 48,
          patchWidth: 64,
          activationMapUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
        }),
      ])
    )
  })
})
