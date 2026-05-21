import { useCallback, useRef, useState } from "react"
import {
  FileImageIcon,
  HeartPulseIcon,
  ImagePlusIcon,
  StethoscopeIcon,
  WavesIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { SAMPLES } from "~/lib/samples"
import type { Sample } from "~/lib/samples"
import type { LoadedImage } from "./types"

const ACCEPT_MIME = [
  "image/*",
  ".dcm",
  ".dicom",
  ".dcm30",
  "application/dicom",
  "application/x-dicom",
].join(",")

type UploadZoneProps = {
  onLoad: (image: LoadedImage) => void
  onError: (message: string) => void
  isBusy: boolean
}

export function UploadZone({ onLoad, onError, isBusy }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const looksDicom =
        /\.(dcm|dicom)$/i.test(file.name) || file.type === "application/dicom"
      const looksImage = /^image\//.test(file.type)

      if (!looksDicom && !looksImage) {
        onError(
          `Unsupported file type: ${file.type || file.name}. Please upload a PNG, JPG, WebP, or DICOM.`
        )
        return
      }

      if (looksDicom) {
        onLoad({
          source: { kind: "file", file },
          displayName: file.name,
          imageUrl: "/samples/cxr/0a0b773c653cea6653a1e02faf1566a5.png",
          isDicom: true,
        })
        return
      }

      const imageUrl = URL.createObjectURL(file)
      onLoad({
        source: { kind: "file", file },
        displayName: file.name,
        imageUrl,
        isDicom: false,
      })
    },
    [onLoad, onError]
  )

  const handleSample = useCallback(
    (sample: Sample) => {
      onLoad({
        source: { kind: "sample", id: sample.id },
        displayName: sample.title,
        imageUrl: sample.imageUrl,
        isDicom: false,
      })
    },
    [onLoad]
  )

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-5 px-4 py-10 sm:py-16">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/5">
          <StethoscopeIcon className="size-3" />
          Interpretable multi-label chest X-ray classification
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Upload a chest X-ray.
          <br />
          <span className="text-muted-foreground">
            See the reasoning behind the prediction.
          </span>
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Muck predicts 14 cardiopulmonary pathologies using a prototype-based
          architecture, and produces an occurrence map showing{" "}
          <em className="not-italic font-medium text-foreground">where</em> and{" "}
          <em className="not-italic font-medium text-foreground">why</em> each
          label fired — no black box.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label="Upload chest X-ray"
        aria-busy={isBusy}
        className={cn(
          "group/drop relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-14 text-center transition-all",
          "hover:border-foreground/25 hover:bg-card focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          dragging && "border-foreground/40 bg-card ring-[3px] ring-foreground/10",
          isBusy && "pointer-events-none opacity-60"
        )}
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

        <div className="grid size-12 place-items-center rounded-2xl bg-background ring-1 ring-foreground/10 transition-transform group-hover/drop:scale-105">
          <ImagePlusIcon className="size-5 text-foreground/80" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Drop an image, or click to browse</p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP, or DICOM · up to ~20 MB · stays on your device
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-center text-xs tracking-wide text-muted-foreground uppercase">
          Or try a curated sample
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SAMPLES.map((sample) => (
            <SampleChip
              key={sample.id}
              sample={sample}
              onSelect={() => handleSample(sample)}
              disabled={isBusy}
            />
          ))}
        </div>
      </div>

      <Alert className="border-dashed">
        <FileImageIcon />
        <AlertTitle>DICOM preview is simulated</AlertTitle>
        <AlertDescription>
          This public demo does not ship a DICOM pixel decoder. DICOM uploads
          are accepted for workflow realism but visualised with a stand-in
          radiograph. Predictions remain deterministic per-file.
        </AlertDescription>
      </Alert>
    </div>
  )
}

type SampleChipProps = {
  sample: Sample
  onSelect: () => void
  disabled: boolean
}

function SampleChip({ sample, onSelect, disabled }: SampleChipProps) {
  const Icon =
    sample.id === "sample-normal"
      ? StethoscopeIcon
      : sample.id === "sample-cardiomegaly"
        ? HeartPulseIcon
        : WavesIcon

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onSelect}
      disabled={disabled}
      className="group/sample h-auto flex-col items-start gap-2 rounded-2xl px-4 py-3.5 text-left"
    >
      <div className="flex w-full items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-muted text-foreground/80">
          <Icon className="size-3.5" />
        </span>
        <span className="text-sm font-medium">{sample.title}</span>
      </div>
      <span className="w-full text-xs text-wrap text-muted-foreground">
        {sample.caption}
      </span>
    </Button>
  )
}
