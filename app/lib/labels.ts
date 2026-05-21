/**
 * Metadata for the 15 unified labels used by the Muck CXR demo.
 *
 * The 14 pathology classes + "No finding" mirror the class set used by
 * VinDr-CXR (see `dataset/train.csv`). This list is the single source of
 * truth for class id/name, UI colour, human-readable clinical note, and the
 * anatomical regions where occurrence-map blobs are biased to land in the
 * mock inference pipeline.
 */

export type AnatomicalBlob = {
  /** normalized centre x in [0, 1] */
  cx: number
  /** normalized centre y in [0, 1] */
  cy: number
  /** normalized radius x in [0, 1] */
  rx: number
  /** normalized radius y in [0, 1] */
  ry: number
}

export type Label = {
  id: number
  name: string
  shortName: string
  /**
   * Colour used for overlay, chip, progress, and heatmap tint.
   * CSS colour string (oklch for crisp, consistent overlays in light & dark).
   */
  color: string
  /** One- to two-sentence plain-language note for the expandable row. */
  clinicalNote: string
  /**
   * Candidate blob positions for the occurrence heatmap. The mock API
   * samples one (or two for bilateral pathologies) using a seeded PRNG.
   * Coordinates are in normalized image space (0..1, origin top-left).
   */
  candidateBlobs: AnatomicalBlob[]
  /** Whether a predicted instance typically carries a bounding box. */
  hasBbox: boolean
}

export const LABELS: readonly Label[] = [
  {
    id: 0,
    name: "Aortic enlargement",
    shortName: "Aortic enlargement",
    color: "oklch(0.70 0.18 20)",
    clinicalNote:
      "Widening of the aortic silhouette on PA view. Commonly associated with hypertension, aneurysmal dilation, or tortuous aorta in older adults.",
    candidateBlobs: [{ cx: 0.46, cy: 0.32, rx: 0.11, ry: 0.09 }],
    hasBbox: true,
  },
  {
    id: 1,
    name: "Atelectasis",
    shortName: "Atelectasis",
    color: "oklch(0.78 0.17 85)",
    clinicalNote:
      "Partial or complete collapse of a lung segment. Appears as volume loss with displacement of adjacent structures.",
    candidateBlobs: [
      { cx: 0.33, cy: 0.62, rx: 0.1, ry: 0.08 },
      { cx: 0.67, cy: 0.6, rx: 0.1, ry: 0.08 },
    ],
    hasBbox: true,
  },
  {
    id: 2,
    name: "Calcification",
    shortName: "Calcification",
    color: "oklch(0.82 0.05 240)",
    clinicalNote:
      "Focal calcium deposits, usually post-infectious (granulomatous) or vascular. High-attenuation foci stand out against surrounding parenchyma.",
    candidateBlobs: [
      { cx: 0.3, cy: 0.4, rx: 0.05, ry: 0.05 },
      { cx: 0.7, cy: 0.42, rx: 0.05, ry: 0.05 },
    ],
    hasBbox: true,
  },
  {
    id: 3,
    name: "Cardiomegaly",
    shortName: "Cardiomegaly",
    color: "oklch(0.66 0.22 25)",
    clinicalNote:
      "Enlarged cardiac silhouette with cardiothoracic ratio greater than 0.5 on PA chest radiograph. Suggests chronic volume or pressure overload.",
    candidateBlobs: [{ cx: 0.44, cy: 0.62, rx: 0.18, ry: 0.14 }],
    hasBbox: true,
  },
  {
    id: 4,
    name: "Consolidation",
    shortName: "Consolidation",
    color: "oklch(0.74 0.18 55)",
    clinicalNote:
      "Alveolar filling by fluid, cells, or tissue producing homogeneous opacification. Air bronchograms may be visible.",
    candidateBlobs: [
      { cx: 0.3, cy: 0.56, rx: 0.11, ry: 0.1 },
      { cx: 0.7, cy: 0.58, rx: 0.11, ry: 0.1 },
    ],
    hasBbox: true,
  },
  {
    id: 5,
    name: "ILD",
    shortName: "ILD",
    color: "oklch(0.66 0.22 295)",
    clinicalNote:
      "Interstitial lung disease pattern: diffuse reticular, nodular, or reticulonodular opacities, usually bilateral and basal-predominant.",
    candidateBlobs: [
      { cx: 0.32, cy: 0.65, rx: 0.11, ry: 0.09 },
      { cx: 0.68, cy: 0.65, rx: 0.11, ry: 0.09 },
    ],
    hasBbox: true,
  },
  {
    id: 6,
    name: "Infiltration",
    shortName: "Infiltration",
    color: "oklch(0.68 0.22 325)",
    clinicalNote:
      "Non-specific term for parenchymal opacification from fluid, cells, or protein. Less well-defined than consolidation.",
    candidateBlobs: [
      { cx: 0.33, cy: 0.5, rx: 0.1, ry: 0.09 },
      { cx: 0.67, cy: 0.52, rx: 0.1, ry: 0.09 },
    ],
    hasBbox: true,
  },
  {
    id: 7,
    name: "Lung Opacity",
    shortName: "Lung opacity",
    color: "oklch(0.72 0.14 230)",
    clinicalNote:
      "General descriptor for any area of increased attenuation within the lung fields. Requires correlation to further specify.",
    candidateBlobs: [
      { cx: 0.33, cy: 0.55, rx: 0.12, ry: 0.1 },
      { cx: 0.67, cy: 0.55, rx: 0.12, ry: 0.1 },
    ],
    hasBbox: true,
  },
  {
    id: 8,
    name: "Nodule/Mass",
    shortName: "Nodule / mass",
    color: "oklch(0.72 0.2 340)",
    clinicalNote:
      "Focal rounded opacity. Nodules are <3 cm, masses are ≥3 cm. Warrants follow-up imaging and possible tissue sampling.",
    candidateBlobs: [
      { cx: 0.27, cy: 0.45, rx: 0.05, ry: 0.05 },
      { cx: 0.73, cy: 0.47, rx: 0.05, ry: 0.05 },
      { cx: 0.35, cy: 0.36, rx: 0.05, ry: 0.05 },
    ],
    hasBbox: true,
  },
  {
    id: 9,
    name: "Other lesion",
    shortName: "Other lesion",
    color: "oklch(0.7 0.03 280)",
    clinicalNote:
      "Abnormality present that does not fit the other defined categories. Flagged for radiologist review.",
    candidateBlobs: [
      { cx: 0.4, cy: 0.45, rx: 0.07, ry: 0.07 },
      { cx: 0.6, cy: 0.5, rx: 0.07, ry: 0.07 },
    ],
    hasBbox: true,
  },
  {
    id: 10,
    name: "Pleural effusion",
    shortName: "Pleural effusion",
    color: "oklch(0.72 0.13 190)",
    clinicalNote:
      "Fluid in the pleural space producing blunting of the costophrenic angle and a meniscus sign on upright views.",
    candidateBlobs: [
      { cx: 0.24, cy: 0.78, rx: 0.12, ry: 0.07 },
      { cx: 0.76, cy: 0.78, rx: 0.12, ry: 0.07 },
    ],
    hasBbox: true,
  },
  {
    id: 11,
    name: "Pleural thickening",
    shortName: "Pleural thickening",
    color: "oklch(0.62 0.18 265)",
    clinicalNote:
      "Focal or diffuse pleural opacification, typically post-inflammatory. May suggest asbestos exposure when bilateral and calcified.",
    candidateBlobs: [
      { cx: 0.2, cy: 0.55, rx: 0.06, ry: 0.1 },
      { cx: 0.8, cy: 0.55, rx: 0.06, ry: 0.1 },
    ],
    hasBbox: true,
  },
  {
    id: 12,
    name: "Pneumothorax",
    shortName: "Pneumothorax",
    color: "oklch(0.85 0.17 100)",
    clinicalNote:
      "Air in the pleural space producing a visible visceral pleural line with absent lung markings peripheral to it.",
    candidateBlobs: [
      { cx: 0.2, cy: 0.3, rx: 0.1, ry: 0.14 },
      { cx: 0.8, cy: 0.3, rx: 0.1, ry: 0.14 },
    ],
    hasBbox: true,
  },
  {
    id: 13,
    name: "Pulmonary fibrosis",
    shortName: "Pulmonary fibrosis",
    color: "oklch(0.7 0.15 155)",
    clinicalNote:
      "Chronic interstitial scarring producing reticular opacities, volume loss, and traction bronchiectasis predominantly in lower zones.",
    candidateBlobs: [
      { cx: 0.3, cy: 0.7, rx: 0.11, ry: 0.08 },
      { cx: 0.7, cy: 0.7, rx: 0.11, ry: 0.08 },
    ],
    hasBbox: true,
  },
  {
    id: 14,
    name: "No finding",
    shortName: "No finding",
    color: "oklch(0.7 0.02 240)",
    clinicalNote:
      "No radiographic evidence of the target pathologies. Note: absence of finding does not rule out clinical disease.",
    candidateBlobs: [],
    hasBbox: false,
  },
] as const

export const LABELS_BY_ID: Record<number, Label> = Object.fromEntries(
  LABELS.map((l) => [l.id, l])
)

export const NO_FINDING_ID = 14

export const PATHOLOGY_IDS = LABELS.filter(
  (l) => l.id !== NO_FINDING_ID
).map((l) => l.id)
