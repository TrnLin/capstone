import type { InferenceResult } from "./inference"

export type OccurrenceMapSelection = {
  status: "available" | "unavailable" | "below-threshold"
  predictionKey: string | null
  label: string | null
  imageUrl: string | null
}

export type ExplanationAvailability = {
  occurrenceMaps: boolean
  prototypes: boolean
  boundingBoxes: false
}

export function getExplanationAvailability(
  result: InferenceResult | null
): ExplanationAvailability {
  return {
    occurrenceMaps:
      result?.predictions.some((prediction) =>
        Boolean(prediction.occurrenceMapUrl)
      ) ?? false,
    prototypes: (result?.prototypes.length ?? 0) > 0,
    boundingBoxes: false,
  }
}

export function selectOccurrenceMap(
  result: InferenceResult,
  displayThreshold: number,
  focusedPredictionKey: string | null
): OccurrenceMapSelection {
  if (focusedPredictionKey !== null) {
    const focused = result.predictions.find(
      (prediction) => prediction.key === focusedPredictionKey
    )
    if (!focused) return unavailableSelection()
    if (focused.probability < displayThreshold) {
      return {
        status: "below-threshold",
        predictionKey: focused.key,
        label: focused.label,
        imageUrl: null,
      }
    }
    return {
      status: focused.occurrenceMapUrl ? "available" : "unavailable",
      predictionKey: focused.key,
      label: focused.label,
      imageUrl: focused.occurrenceMapUrl,
    }
  }

  let selected: InferenceResult["predictions"][number] | null = null
  for (const prediction of result.predictions) {
    if (
      prediction.probability < displayThreshold ||
      !prediction.occurrenceMapUrl
    ) {
      continue
    }
    if (!selected || prediction.probability > selected.probability) {
      selected = prediction
    }
  }

  if (!selected) return unavailableSelection()
  return {
    status: "available",
    predictionKey: selected.key,
    label: selected.label,
    imageUrl: selected.occurrenceMapUrl,
  }
}

function unavailableSelection(): OccurrenceMapSelection {
  return {
    status: "unavailable",
    predictionKey: null,
    label: null,
    imageUrl: null,
  }
}
