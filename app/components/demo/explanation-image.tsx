import { useEffect, useRef, useState } from "react"
import { ImageOffIcon, LoaderCircleIcon } from "lucide-react"

import { cn } from "~/lib/utils"

type ExplanationImageProps = {
  src: string | null
  alt: string
  unavailableText: string
  className?: string
  imageClassName?: string
}

export function ExplanationImage({
  src,
  alt,
  unavailableText,
  className,
  imageClassName,
}: ExplanationImageProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">(
    src ? "loading" : "ready"
  )
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!src) {
      setState("ready")
      return
    }

    const image = imageRef.current
    setState(
      image?.complete ? (image.naturalWidth > 0 ? "ready" : "error") : "loading"
    )
  }, [src])

  if (!src || state === "error") {
    return (
      <div
        className={cn(
          "grid size-full place-items-center bg-muted/60 p-2 text-center text-muted-foreground",
          className
        )}
      >
        <div className="flex flex-col items-center gap-1.5 text-[10px] leading-tight">
          <ImageOffIcon className="size-4 opacity-60" />
          <span className="text-pretty">
            {state === "error"
              ? "Image could not be displayed"
              : unavailableText}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn("relative size-full overflow-hidden bg-black", className)}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
        className={cn(
          "size-full object-cover outline -outline-offset-1 outline-black/10 transition-opacity duration-200 ease-out dark:outline-white/10",
          state === "ready" ? "opacity-100" : "opacity-0",
          imageClassName
        )}
      />
      {state === "loading" ? (
        <div className="absolute inset-0 grid place-items-center bg-muted/30">
          <LoaderCircleIcon className="size-4 animate-spin text-white/70" />
        </div>
      ) : null}
    </div>
  )
}
