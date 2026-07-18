import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert"
import { AuthDialog } from "~/components/demo/auth-dialog"
import { Button } from "~/components/ui/button"
import { ControlsPanel } from "~/components/demo/controls-panel"
import { DemoHeader } from "~/components/demo/demo-header"
import { HistoryPanel } from "~/components/demo/history-panel"
import { JsonInspector } from "~/components/demo/json-inspector"
import { PredictionList } from "~/components/demo/prediction-list"
import { Viewer } from "~/components/demo/viewer"
import {
  ApiError,
  createBackendApiClient,
  type PredictionDetail,
  type PredictionJob,
  type PredictionSummary,
  type UserResponse,
} from "~/lib/backend-api"
import { normalizeBackendPredictionResponse } from "~/lib/backend-adapter"
import { getInitialDisplayThreshold } from "~/lib/explainability"
import type { InferenceResult } from "~/lib/inference"
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

const SESSION_STORAGE_KEY = "muck-session-token"
const JOB_POLL_INTERVAL_MS = 900
type BackendApiClient = ReturnType<typeof createBackendApiClient>

export default function Home() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<DemoStatus>("ready")
  const [error, setError] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [overlayMode, setOverlayMode] = useState<OverlayMode>("heatmap")
  const [displayThreshold, setDisplayThreshold] = useState(0.5)
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.62)
  const [activePredictionKey, setActivePredictionKey] = useState<string | null>(
    null
  )
  const [compare, setCompare] = useState(false)

  const requestId = useRef(0)

  const clearSession = useCallback((openDialog = false) => {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSessionToken(null)
    setUser(null)
    if (openDialog) setAuthOpen(true)
  }, [])

  const api = useMemo(
    () =>
      createBackendApiClient({
        getToken: () => sessionToken,
        onUnauthorized: () => {
          clearSession(true)
          setError("Your session expired. Please log in again.")
        },
      }),
    [clearSession, sessionToken]
  )

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

  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) {
      setAuthLoading(false)
      return
    }

    setSessionToken(stored)
    const restoreApi = createBackendApiClient({
      getToken: () => stored,
      onUnauthorized: () => clearSession(false),
    })
    restoreApi
      .me()
      .then((restoredUser) => {
        if (!cancelled) setUser(restoredUser)
      })
      .catch(() => {
        if (!cancelled) clearSession(false)
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clearSession])

  useEffect(() => {
    if (!sessionToken || !user) {
      setHistory([])
      setActiveId(null)
      return
    }

    let cancelled = false
    const objectUrls: string[] = []

    async function loadHistory() {
      try {
        const summaries = await api.listPredictions(50)
        const details = await Promise.all(
          summaries.map(async (summary) => ({
            summary,
            detail: await api.getPrediction(summary.id),
          }))
        )
        const items = await Promise.all(
          details.map(async ({ summary, detail }) => {
            const item = await predictionHistoryItem(api, summary, detail)
            if (item.revokeImageUrl) objectUrls.push(item.imageUrl)
            return item
          })
        )
        if (cancelled) {
          objectUrls.forEach((url) => URL.revokeObjectURL(url))
          return
        }
        setHistory(items)
        setActiveId((current) =>
          current && items.some((item) => item.id === current)
            ? current
            : (items[0]?.id ?? null)
        )
      } catch (e) {
        if (!cancelled) setError(messageForError(e))
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [api, sessionToken, user])

  const updateItem = useCallback((id: string, patch: Partial<HistoryItem>) => {
    setHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
    )
  }, [])

  const handleAuthSubmit = useCallback(
    async (mode: "login" | "register", email: string, password: string) => {
      setAuthSubmitting(true)
      setAuthError(null)
      try {
        const response =
          mode === "login"
            ? await api.login(email, password)
            : await api.register(email, password)
        localStorage.setItem(SESSION_STORAGE_KEY, response.session_token)
        setSessionToken(response.session_token)
        setUser(response.user)
        setAuthOpen(false)
        setError(null)
      } catch (e) {
        setAuthError(messageForError(e))
      } finally {
        setAuthSubmitting(false)
      }
    },
    [api]
  )

  const handleLogout = useCallback(async () => {
    try {
      if (sessionToken) await api.logout()
    } catch {
      // Local session cleanup still wins if the backend is unavailable.
    } finally {
      requestId.current++
      clearSession(false)
      setHistory([])
      setActiveId(null)
      setStatus("idle")
      setError(null)
    }
  }, [api, clearSession, sessionToken])

  const requireSession = useCallback(
    (message: string) => {
      if (sessionToken && user) return true
      setAuthError(null)
      setAuthOpen(true)
      setError(message)
      return false
    },
    [sessionToken, user]
  )

  const runInference = useCallback(
    async (item: HistoryItem) => {
      if (!requireSession("Please log in before submitting a CXR study.")) {
        return
      }
      const rid = ++requestId.current
      setStatus("loading")
      setError(null)
      setActivePredictionKey(null)

      try {
        const file = await fileForHistoryItem(item)
        let job = await api.createPredictionJob(file, {
          topKProtos: 0,
          includeTiming: true,
        })
        updateItem(item.id, jobPatch(job))

        while (job.status === "queued" || job.status === "processing") {
          await delay(JOB_POLL_INTERVAL_MS)
          job = await api.getPredictionJob(job.id)
          updateItem(item.id, jobPatch(job))
        }

        if (job.status !== "completed" || !job.response) {
          throw new Error(job.error_message || `Prediction job ${job.status}`)
        }

        const res = normalizeBackendPredictionResponse(job.response, {
          fallbackImageId: job.image_id,
          fallbackFilename: item.displayName,
          resolveApiUrl: api.apiUrl,
        })
        updateItem(item.id, {
          cachedResult: res,
          backendPredictionId: job.prediction_id,
          backendImageId: job.image_id,
          jobStatus: job.status,
          errorMessage: null,
        })
        if (requestId.current === rid) setStatus("ready")
      } catch (e) {
        const message = messageForError(e)
        updateItem(item.id, {
          jobStatus: "failed",
          errorMessage: message,
        })
        if (requestId.current !== rid) return
        setStatus("error")
        setError(message)
      }
    },
    [api, requireSession, updateItem]
  )

  // When the active item changes, run inference if we don't already have a
  // cached result for it. Curated samples arrive with a baked result so this
  // is effectively a no-op for them.
  useEffect(() => {
    if (!activeItem) {
      setStatus("idle")
      return
    }
    setActivePredictionKey(null)
    setCompare(false)
    if (activeItem.cachedResult) {
      setStatus("ready")
      requestId.current++
      return
    }
    if (activeItem.jobStatus === "failed") {
      setStatus("error")
      setError(activeItem.errorMessage ?? "Prediction job failed.")
      requestId.current++
      return
    }
    if (!sessionToken || !user) {
      setStatus("idle")
      return
    }
    void runInference(activeItem)
  }, [activeItem?.id, runInference, sessionToken, user])

  // Track file-backed history items so we can revoke their object URLs when
  // they leave the list (or when the page unmounts).
  const ownedUrls = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const alive = new Set(history.map((h) => h.id))
    history.forEach((h) => {
      if (h.revokeImageUrl) {
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

  const handleUpload = useCallback(
    (loaded: LoadedImage) => {
      if (!requireSession("Please log in before uploading a CXR study.")) {
        if (loaded.source.kind === "file" && !loaded.isDicom) {
          URL.revokeObjectURL(loaded.imageUrl)
        }
        return
      }
      const id = makeId()
      const item: HistoryItem = {
        id,
        addedAt: Date.now(),
        source: loaded.source,
        displayName: loaded.displayName,
        imageUrl: loaded.imageUrl,
        isDicom: loaded.isDicom,
        cachedResult: null,
        jobStatus: "queued",
        revokeImageUrl: loaded.source.kind === "file" && !loaded.isDicom,
      }
      setHistory((prev) => [item, ...prev])
      setActiveId(id)
    },
    [requireSession]
  )

  const handleAddSample = useCallback(
    (sample: Sample) => {
      if (!requireSession("Please log in before submitting a sample study.")) {
        return
      }
      const id = makeId()
      const item: HistoryItem = {
        id,
        addedAt: Date.now(),
        source: { kind: "sample", id: sample.id },
        displayName: sample.title,
        imageUrl: sample.imageUrl,
        isDicom: false,
        cachedResult: null,
        jobStatus: "queued",
      }
      setHistory((prev) => [item, ...prev])
      setActiveId(id)
    },
    [requireSession]
  )

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

  useEffect(() => {
    if (result) setDisplayThreshold(getInitialDisplayThreshold(result))
  }, [activeItem?.id, result?.modelThreshold])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <DemoHeader
        user={user}
        authLoading={authLoading}
        onAuthClick={() => {
          setAuthError(null)
          setAuthOpen(true)
        }}
        onLogout={handleLogout}
      />
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

          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px] xl:gap-4 2xl:grid-cols-[260px_minmax(0,1fr)_360px]">
            <div className="xl:sticky xl:top-[72px] xl:h-[calc(100svh-88px)]">
              <HistoryPanel
                items={history}
                activeId={activeId}
                onSelect={handleSelect}
                onRemove={handleRemove}
                onUpload={handleUpload}
                onAddSample={handleAddSample}
                onError={handleError}
                className="xl:h-full"
              />
            </div>

            <div className="flex min-h-[60svh] flex-col xl:sticky xl:top-[72px] xl:h-[calc(100svh-88px)]">
              {image ? (
                <Viewer
                  image={image}
                  result={result}
                  loading={status === "loading"}
                  overlayMode={overlayMode}
                  displayThreshold={displayThreshold}
                  heatmapOpacity={heatmapOpacity}
                  activePredictionKey={activePredictionKey}
                  onClearActive={() => setActivePredictionKey(null)}
                  compare={compare}
                  className="xl:h-full"
                />
              ) : (
                <EmptyViewer />
              )}
            </div>

            <div className="flex flex-col gap-4 xl:sticky xl:top-[72px] xl:h-[calc(100svh-88px)]">
              <ControlsPanel
                overlayMode={overlayMode}
                onOverlayModeChange={setOverlayMode}
                result={result}
                displayThreshold={displayThreshold}
                onDisplayThresholdChange={setDisplayThreshold}
                heatmapOpacity={heatmapOpacity}
                onHeatmapOpacityChange={setHeatmapOpacity}
                compare={compare}
                onCompareChange={setCompare}
                activePredictionKey={activePredictionKey}
                onClearActive={() => setActivePredictionKey(null)}
                disabled={!image}
              />
              <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <PredictionList
                  result={result}
                  loading={status === "loading"}
                  displayThreshold={displayThreshold}
                  activePredictionKey={activePredictionKey}
                  onFocusPrediction={setActivePredictionKey}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <JsonInspector result={result} />
          </div>

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 pb-6 text-xs text-muted-foreground">
            <span>
              Muck · Interpretable Multi-Label CXR Classification via Prototype
              Learning
            </span>
            <span className="tabular-nums">
              RMIT SSET Capstone · model: {result?.modelVersion ?? "not loaded"}
            </span>
          </footer>
        </div>
      </main>
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSubmit={handleAuthSubmit}
        loading={authSubmitting}
        error={authError}
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
          studies to see backend-provided predictions and occurrence maps.
        </p>
      </div>
    </div>
  )
}

async function predictionHistoryItem(
  api: BackendApiClient,
  summary: PredictionSummary,
  detail: PredictionDetail
): Promise<HistoryItem> {
  let imageUrl = "/samples/normal.svg"
  let revokeImageUrl = false
  try {
    const blob = await api.fetchImageBlob(detail.image_id)
    imageUrl = URL.createObjectURL(blob)
    revokeImageUrl = true
  } catch {
    // A missing preview should not hide the persisted prediction result.
  }

  return {
    id: `prediction_${detail.id}`,
    addedAt: new Date(summary.created_at).getTime(),
    source: {
      kind: "remote",
      imageId: detail.image_id,
      predictionId: detail.id,
    },
    displayName: summary.original_filename,
    imageUrl,
    isDicom: /\.(dcm|dicom|dcm30)$/i.test(summary.original_filename),
    cachedResult: normalizeBackendPredictionResponse(detail.response, {
      fallbackImageId: detail.image_id,
      fallbackFilename: summary.original_filename,
      resolveApiUrl: api.apiUrl,
    }),
    backendImageId: detail.image_id,
    backendPredictionId: detail.id,
    jobStatus: "completed",
    revokeImageUrl,
  }
}

async function fileForHistoryItem(item: HistoryItem) {
  if (item.source.kind === "file") return item.source.file
  if (item.source.kind === "sample") {
    const sample = SAMPLES_BY_ID[item.source.id]
    if (!sample) throw new Error("Sample study not found.")
    const response = await fetch(sample.imageUrl)
    if (!response.ok) {
      throw new Error(`Could not load sample study (${response.status}).`)
    }
    const blob = await response.blob()
    return new File([blob], `${sample.id}.png`, {
      type: blob.type || "image/png",
    })
  }
  throw new Error("Stored predictions do not need to be submitted again.")
}

function jobPatch(job: PredictionJob): Partial<HistoryItem> {
  return {
    backendJobId: job.id,
    backendImageId: job.image_id,
    backendPredictionId: job.prediction_id,
    jobStatus: job.status,
    errorMessage: job.error_message,
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function messageForError(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Unexpected backend error."
}
