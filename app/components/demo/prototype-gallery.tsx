import { SparklesIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Separator } from "~/components/ui/separator"
import { LABELS_BY_ID } from "~/lib/labels"
import type { InferenceResult } from "~/lib/mock-api"

import { PrototypeThumbnail } from "./prototype-thumbnail"

type PrototypeGalleryProps = {
  result: InferenceResult | null
  labelId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrototypeGallery({
  result,
  labelId,
  open,
  onOpenChange,
}: PrototypeGalleryProps) {
  const label = labelId !== null ? LABELS_BY_ID[labelId] : undefined
  const prototypes = result && labelId !== null
    ? result.prototypes.filter((p) => p.labelId === labelId)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: label?.color ?? "#888" }}
            />
            Nearest prototypes · {label?.name ?? "–"}
          </DialogTitle>
          <DialogDescription>
            The prototype-based classifier matched this region against the
            closest {prototypes.length} learned exemplars. Each tile
            represents a patch the model has seen during training.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        {label && (
          <p className="-mt-1 text-sm text-muted-foreground">
            {label.clinicalNote}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2.5">
          {prototypes.map((p, i) => (
            <div
              key={p.prototypeId}
              className="flex flex-col gap-1.5 rounded-xl bg-muted/40 p-2 ring-1 ring-foreground/10"
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
                <PrototypeThumbnail
                  seed={p.thumbnailSeed}
                  labelId={p.labelId}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>#{i + 1}</span>
                <span className="font-medium text-foreground">
                  {(p.similarity * 100).toFixed(1)}%
                </span>
              </div>
              <Badge variant="outline" className="w-full justify-center text-[10px]">
                {p.sourceDataset}
              </Badge>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {p.prototypeId}
              </div>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <SparklesIcon className="size-3" />
          Prototype thumbnails are illustrative — the real model indexes patch
          activations; demo renders a seeded motif per prototype id.
        </p>
      </DialogContent>
    </Dialog>
  )
}
