import type { InferenceResult } from "./inference"
import { NO_FINDING_ID } from "./labels"

export type OccurrenceMapSelection = {
  status: "available" | "unavailable" | "below-threshold"
  predictionKey: string | null
  label: string | null
  imageUrl: string | null
}

export type ExplanationAvailability = {
  occurrenceMaps: boolean
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
    boundingBoxes: false,
  }
}

export function getInitialDisplayThreshold(result: InferenceResult): number {
  const highestPathologyProbability = result.predictions.reduce<number | null>(
    (highest, prediction) => {
      if (prediction.labelId === NO_FINDING_ID) return highest
      return highest === null
        ? prediction.probability
        : Math.max(highest, prediction.probability)
    },
    null
  )

  if (
    highestPathologyProbability !== null &&
    highestPathologyProbability < 0.5
  ) {
    // Match the slider's 0.01 step and round down so the top evidence remains
    // visible even when the backend returns three decimal places.
    return Math.floor(highestPathologyProbability * 100) / 100
  }

  return result.modelThreshold
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
    if (focused.labelId === NO_FINDING_ID) return unavailableSelection()
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
      prediction.labelId === NO_FINDING_ID ||
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
