import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { ControlsPanel } from "~/components/demo/controls-panel"
import { DemoHeader } from "~/components/demo/demo-header"
import { HistoryPanel } from "~/components/demo/history-panel"
import { JsonInspector } from "~/components/demo/json-inspector"
import { PredictionList } from "~/components/demo/prediction-list"
import { PrototypeGallery } from "~/components/demo/prototype-gallery"
import { Viewer } from "~/components/demo/viewer"
import { mockInfer } from "~/lib/mock-api"
import type { InferenceResult } from "~/lib/mock-api"
import { SAMPLES, SAMPLES_BY_ID } from "~/lib/samples"
import type { Sample } from "~/lib/samples"
import type {
  DemoStatus,
  HistoryItem,
  LoadedImage,
  OverlayMode,
} from "~/components/demo/types"

export function meta() {
  return [
    { title: "Muck · Interpretable CXR Classification — Demo" },
    {
      name: "description",
      content:
        "Interactive demo for the Muck capstone: prototype-based, multi-label chest X-ray classification with occurrence-map explanations.",
    },
  ]
}

function makeId() {
  return `hist_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`
}

function seedHistory(): HistoryItem[] {
  // Pre-populate with the 3 curated samples so the 3-column layout is
  // populated on first load. Their pre-baked results make selection instant.
  return SAMPLES.map((sample, i) => ({
    id: `seed_${sample.id}`,
    addedAt: Date.now() - (SAMPLES.length - i) * 60_000,
    source: { kind: "sample", id: sample.id },
    displayName: sample.title,
    imageUrl: sample.imageUrl,
    isDicom: false,
    cachedResult: sample.bakedResult,
  }))
}

export default function Home() {
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory())
  const [activeId, setActiveId] = useState<string | null>(
    () => seedHistory()[0]?.id ?? null
  )
  const [status, setStatus] = useState<DemoStatus>("ready")
  const [error, setError] = useState<string | null>(null)

  const [overlayMode, setOverlayMode] = useState<OverlayMode>("heatmap")
  const [threshold, setThreshold] = useState(0.35)
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.65)
  const [activeLabelId, setActiveLabelId] = useState<number | null>(null)
  const [compare, setCompare] = useState(false)

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryLabel, setGalleryLabel] = useState<number | null>(null)

  const requestId = useRef(0)

  const activeItem = useMemo(
    () => history.find((h) => h.id === activeId) ?? null,
    [history, activeId]
  )
  const image: LoadedImage | null = activeItem
    ? {
        source: activeItem.source,
        displayName: activeItem.displayName,
        imageUrl: activeItem.imageUrl,
        isDicom: activeItem.isDicom,
      }
    : null
  const result = activeItem?.cachedResult ?? null

  const updateItem = useCallback(
    (id: string, patch: Partial<HistoryItem>) => {
      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
      )
    },
    []
  )

  const runInference = useCallback(
    async (item: HistoryItem) => {
      const rid = ++requestId.current
      setStatus("loading")
      setError(null)
      setActiveLabelId(null)

      try {
        if (item.source.kind === "sample") {
          const sampleId = item.source.id
          const sample = SAMPLES_BY_ID[sampleId]
          if (sample) {
            await new Promise((r) =>
              setTimeout(r, 480 + ((sampleId.length * 30) % 400))
            )
            if (requestId.current !== rid) return
            updateItem(item.id, { cachedResult: sample.bakedResult })
            setStatus("ready")
            return
          }
        }

        const res = await mockInfer(
          item.source.kind === "file"
            ? { kind: "file", file: item.source.file }
            : { kind: "sample", id: item.source.id, size: 0 }
        )
        if (requestId.current !== rid) return
        updateItem(item.id, { cachedResult: res })
        setStatus("ready")
      } catch (e) {
        if (requestId.current !== rid) return
        setStatus("error")
        setError(
          e instanceof Error
            ? e.message
            : "Unexpected error while running inference."
        )
      }
    },
    [updateItem]
  )

  // When the active item changes, run inference if we don't already have a
  // cached result for it. Curated samples arrive with a baked result so this
  // is effectively a no-op for them.
  useEffect(() => {
    if (!activeItem) {
      setStatus("idle")
      return
    }
    setActiveLabelId(null)
    setCompare(false)
    if (activeItem.cachedResult) {
      setStatus("ready")
      requestId.current++
      return
    }
    void runInference(activeItem)
  }, [activeItem?.id])

  // Track file-backed history items so we can revoke their object URLs when
  // they leave the list (or when the page unmounts).
  const ownedUrls = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const alive = new Set(history.map((h) => h.id))
    history.forEach((h) => {
      if (h.source.kind === "file" && !h.isDicom) {
        ownedUrls.current.set(h.id, h.imageUrl)
      }
    })
    for (const [id, url] of ownedUrls.current) {
      if (!alive.has(id)) {
        URL.revokeObjectURL(url)
        ownedUrls.current.delete(id)
      }
    }
  }, [history])

  useEffect(() => {
    return () => {
      ownedUrls.current.forEach((url) => URL.revokeObjectURL(url))
      ownedUrls.current.clear()
    }
  }, [])

  const handleUpload = useCallback((loaded: LoadedImage) => {
    const id = makeId()
    const item: HistoryItem = {
      id,
      addedAt: Date.now(),
      source: loaded.source,
      displayName: loaded.displayName,
      imageUrl: loaded.imageUrl,
      isDicom: loaded.isDicom,
      cachedResult: null,
    }
    setHistory((prev) => [item, ...prev])
    setActiveId(id)
  }, [])

  const handleAddSample = useCallback((sample: Sample) => {
    const id = makeId()
    const item: HistoryItem = {
      id,
      addedAt: Date.now(),
      source: { kind: "sample", id: sample.id },
      displayName: sample.title,
      imageUrl: sample.imageUrl,
      isDicom: false,
      cachedResult: sample.bakedResult,
    }
    setHistory((prev) => [item, ...prev])
    setActiveId(id)
  }, [])

  const handleSelect = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const handleRemove = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const next = prev.filter((h) => h.id !== id)
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null)
        }
        return next
      })
    },
    [activeId]
  )

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const handleOpenGallery = useCallback((labelId: number) => {
    setGalleryLabel(labelId)
    setGalleryOpen(true)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <DemoHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </AlertAction>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-4 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
            <div className="lg:sticky lg:top-[72px] lg:h-[calc(100svh-88px)]">
              <HistoryPanel
                items={history}
                activeId={activeId}
                onSelect={handleSelect}
                onRemove={handleRemove}
                onUpload={handleUpload}
                onAddSample={handleAddSample}
                onError={handleError}
                className="h-full"
              />
            </div>

            <div className="flex min-h-[60svh] flex-col lg:sticky lg:top-[72px] lg:h-[calc(100svh-88px)]">
              {image ? (
                <Viewer
                  image={image}
                  result={result}
                  loading={status === "loading"}
                  overlayMode={overlayMode}
                  threshold={threshold}
                  heatmapOpacity={heatmapOpacity}
                  activeLabelId={activeLabelId}
                  onClearActive={() => setActiveLabelId(null)}
                  compare={compare}
                  className="h-full"
                />
              ) : (
                <EmptyViewer />
              )}
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-[72px] lg:h-[calc(100svh-88px)]">
              <ControlsPanel
                overlayMode={overlayMode}
                onOverlayModeChange={setOverlayMode}
                threshold={threshold}
                onThresholdChange={setThreshold}
                heatmapOpacity={heatmapOpacity}
                onHeatmapOpacityChange={setHeatmapOpacity}
                compare={compare}
                onCompareChange={setCompare}
                activeLabelId={activeLabelId}
                onClearActive={() => setActiveLabelId(null)}
                disabled={!image}
              />
              <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <PredictionList
                  result={result}
                  loading={status === "loading"}
                  threshold={threshold}
                  activeLabelId={activeLabelId}
                  onFocusLabel={setActiveLabelId}
                  onOpenPrototypeGallery={handleOpenGallery}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <JsonInspector result={result} />
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 pb-6 text-xs text-muted-foreground">
            <span>
              Muck · Interpretable Multi-Label CXR Classification via
              Prototype Learning
            </span>
            <span className="tabular-nums">
              RMIT SSET Capstone · model:{" "}
              {result?.modelVersion ?? "not loaded"}
            </span>
          </footer>
        </div>
      </main>
      <PrototypeGallery
        result={result}
        labelId={galleryLabel}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  )
}

function EmptyViewer() {
  return (
    <div className="grid h-full min-h-[60svh] place-items-center rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/10">
      <div className="max-w-sm space-y-2">
        <p className="font-heading text-base font-semibold tracking-tight">
          Pick an X-ray to start
        </p>
        <p className="text-sm text-muted-foreground">
          Upload a CXR from the left panel, or add one of the curated sample
          studies to see prototype-based predictions, occurrence maps, and
          bounding boxes.
        </p>
      </div>
    </div>
  )
}
