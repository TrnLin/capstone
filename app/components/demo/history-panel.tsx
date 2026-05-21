import { useCallback, useRef, useState } from "react"
import {
  ClockIcon,
  ImagePlusIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { SAMPLES } from "~/lib/samples"
import type { Sample } from "~/lib/samples"

import type { HistoryItem, LoadedImage } from "./types"

const DICOM_PREVIEWS = [
  "/samples/cxr/0a0b773c653cea6653a1e02faf1566a5.png",
  "/samples/cxr/0a1addecfc432a1b425d61fe57bc29d2.png",
] as const

const ACCEPT_MIME = [
  "image/*",
  ".dcm",
  ".dicom",
  ".dcm30",
  "application/dicom",
  "application/x-dicom",
].join(",")

type HistoryPanelProps = {
  items: HistoryItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onUpload: (image: LoadedImage) => void
  onAddSample: (sample: Sample) => void
  onError: (message: string) => void
  className?: string
}

export function HistoryPanel({
  items,
  activeId,
  onSelect,
  onRemove,
  onUpload,
  onAddSample,
  onError,
  className,
}: HistoryPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      const looksDicom =
        /\.(dcm|dicom|dcm30)$/i.test(file.name) ||
        file.type === "application/dicom" ||
        file.type === "application/x-dicom"
      const looksImage = /^image\//.test(file.type)

      if (!looksDicom && !looksImage) {
        onError(
          `Unsupported file type: ${file.type || file.name}. Please upload a PNG, JPG, WebP, or DICOM.`
        )
        return
      }

      // Pick a deterministic preview per file so re-uploading the same
      // file always yields the same on-screen image.
      const previewIdx =
        Array.from(file.name).reduce((a, c) => a + c.charCodeAt(0), 0) %
        DICOM_PREVIEWS.length

      onUpload({
        source: { kind: "file", file },
        displayName: file.name,
        imageUrl: looksDicom
          ? DICOM_PREVIEWS[previewIdx]!
          : URL.createObjectURL(file),
        isDicom: looksDicom,
      })
    },
    [onUpload, onError]
  )

  const sampleIdsInHistory = new Set(
    items
      .filter((i) => i.source.kind === "sample")
      .map((i) => (i.source.kind === "sample" ? i.source.id : ""))
  )
  const availableSamples = SAMPLES.filter(
    (s) => !sampleIdsInHistory.has(s.id)
  )

  return (
    <aside
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10",
        "lg:h-full lg:min-h-0",
        className
      )}
      aria-label="Upload history"
    >
      <header className="flex flex-col gap-2 lg:block lg:space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ClockIcon className="size-3.5 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            History
          </h2>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </div>
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed border-border bg-background/50 transition-colors",
            dragOver && "border-foreground/40 bg-background"
          )}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPT_MIME}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ""
            }}
          />
          <Button
            variant="default"
            onClick={() => inputRef.current?.click()}
            className="w-full justify-center"
          >
            <UploadIcon />
            Upload CXR
          </Button>
          <p className="hidden px-3 pt-1 pb-2 text-center text-[10px] text-muted-foreground lg:block">
            drag & drop · PNG, JPG, DICOM
          </p>
        </div>
      </header>

      {availableSamples.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <SparklesIcon className="size-3" />
            Try a sample
          </div>
          <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {availableSamples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onAddSample(sample)}
                className="group/sample flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background/40 px-2 py-1.5 text-left text-xs transition-colors hover:border-foreground/25 hover:bg-background focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ImagePlusIcon className="size-3.5 shrink-0 text-muted-foreground group-hover/sample:text-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {sample.title}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="h-px bg-border" />

      <ol
        className={cn(
          "-mx-1 flex min-h-0 gap-1.5 px-1",
          // Horizontal strip on small screens, vertical list on lg+
          "flex-row overflow-x-auto pb-1",
          "lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0"
        )}
      >
        {items.length === 0 ? (
          <li className="grid w-full place-items-center rounded-xl border border-dashed border-border bg-background/30 px-3 py-8 text-center text-xs text-muted-foreground">
            Upload a CXR or pick a sample
            <br className="hidden lg:inline" />
            {" "}to get started.
          </li>
        ) : (
          items.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              active={activeId === item.id}
              onSelect={() => onSelect(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))
        )}
      </ol>
    </aside>
  )
}

function HistoryRow({
  item,
  active,
  onSelect,
  onRemove,
}: {
  item: HistoryItem
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const topPrediction = item.cachedResult?.predictions.find(
    (p) => p.probability >= 0.35
  )

  return (
    <li
      className={cn(
        "group/row relative flex shrink-0 items-center gap-2.5 rounded-xl border bg-background/40 p-1.5 transition-colors",
        // Width constraints per layout
        "w-[220px] lg:w-auto",
        active
          ? "border-foreground/40 bg-background shadow-[inset_2px_0_0_var(--foreground)]"
          : "border-transparent hover:border-border hover:bg-background/70"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Select ${item.displayName}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[oklch(0.145_0_0)] ring-1 ring-foreground/10">
          <img
            src={item.imageUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{item.displayName}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {item.isDicom && (
              <Badge
                variant="outline"
                className="h-3.5 px-1 py-0 text-[9px] uppercase"
              >
                dicom
              </Badge>
            )}
            {topPrediction ? (
              <span className="truncate">
                {topPrediction.label} ·{" "}
                <span className="tabular-nums">
                  {Math.round(topPrediction.probability * 100)}%
                </span>
              </span>
            ) : item.cachedResult ? (
              <span>No finding</span>
            ) : (
              <span className="italic">pending</span>
            )}
          </div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Remove ${item.displayName} from history`}
        className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
      >
        <Trash2Icon />
      </Button>
    </li>
  )
}
