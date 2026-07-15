import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"

import { LABELS_BY_ID, NO_FINDING_ID } from "~/lib/labels"
import { mockInfer, type InferenceResult } from "~/lib/mock-api"
import { SAMPLES, SAMPLES_BY_ID } from "~/lib/samples"
import type { Sample } from "~/lib/samples"

// Web 1.0 helpers — kept as components so we don't have to fight TS over
// deprecated HTML elements like <font> and <Blink>.
type FontProps = {
  color?: string
  size?: number
  children?: ReactNode
}
function Font({ color, size, children }: FontProps) {
  const style: CSSProperties = {}
  if (color) style.color = color
  if (size) {
    // Map old <Font size> values (1..7) to roughly the right pixel size.
    const sizes: Record<number, number> = {
      1: 10,
      2: 12,
      3: 14,
      4: 16,
      5: 18,
      6: 22,
      7: 28,
    }
    style.fontSize = sizes[size] ?? 14
  }
  return <span style={style}>{children}</span>
}
function Blink({ children }: { children?: ReactNode }) {
  return <span className="blink">{children}</span>
}
type CellProps = HTMLAttributes<HTMLTableCellElement> & {
  bgcolor?: string
  valign?: "top" | "middle" | "bottom"
  width?: string | number
  align?: "left" | "right" | "center"
}
function Td({ bgcolor, valign, width, align, style, ...rest }: CellProps) {
  const merged: CSSProperties = { ...(style ?? {}) }
  if (bgcolor) merged.background = bgcolor
  if (valign) merged.verticalAlign = valign
  if (width !== undefined) merged.width = width
  if (align) merged.textAlign = align
  return <td style={merged} {...rest} />
}
function Th({ bgcolor, valign, width, align, style, ...rest }: CellProps) {
  const merged: CSSProperties = { ...(style ?? {}) }
  if (bgcolor) merged.background = bgcolor
  if (valign) merged.verticalAlign = valign
  if (width !== undefined) merged.width = width
  if (align) merged.textAlign = align
  return <th style={merged} {...rest} />
}
type RowProps = HTMLAttributes<HTMLTableRowElement> & { bgcolor?: string }
function Tr({ bgcolor, style, ...rest }: RowProps) {
  const merged: CSSProperties = { ...(style ?? {}) }
  if (bgcolor) merged.background = bgcolor
  return <tr style={merged} {...rest} />
}
type SectionProps = HTMLAttributes<HTMLTableSectionElement> & {
  bgcolor?: string
}
function Thead({ bgcolor, style, ...rest }: SectionProps) {
  const merged: CSSProperties = { ...(style ?? {}) }
  if (bgcolor) merged.background = bgcolor
  return <thead style={merged} {...rest} />
}

export function meta() {
  return [
    { title: "MUCK :: Mock CXR Classifier (Legacy)" },
    {
      name: "description",
      content:
        "Original 1999-style demo page for the MUCK chest X-ray classifier.",
    },
  ]
}

type LegacyItem = {
  id: string
  title: string
  source:
    | { kind: "sample"; id: string }
    | { kind: "file"; file: File }
  imageUrl: string
  isDicom: boolean
  addedAt: number
  cachedResult: InferenceResult | null
}

type OverlayMode = "heatmap" | "boxes" | "off"

function makeId() {
  return `it_${Math.random().toString(36).slice(2, 9)}`
}

// Fixed reference time so the initial (server + first client) render is
// deterministic. Real "recent" timestamps are filled in on mount, client-side
// only, to avoid a server/client hydration mismatch.
const SEED_BASE_TIME = 1_735_689_600_000 // 2025-01-01T00:00:00Z
const VISITOR_PLACEHOLDER = "0000000"

function seedItems(baseTime: number): LegacyItem[] {
  return SAMPLES.map((s, i) => ({
    id: `seed_${s.id}`,
    title: s.title,
    source: { kind: "sample", id: s.id },
    imageUrl: s.imageUrl,
    isDicom: false,
    addedAt: baseTime - (SAMPLES.length - i) * 60_000,
    cachedResult: s.bakedResult,
  }))
}

function asciiBar(p: number, width = 20) {
  const filled = Math.round(p * width)
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]"
}

function fmtPct(p: number) {
  return (p * 100).toFixed(1) + "%"
}

function fmtTime(t: number) {
  const d = new Date(t)
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  )
}

export default function Legacy() {
  const [items, setItems] = useState<LegacyItem[]>(() =>
    seedItems(SEED_BASE_TIME)
  )
  const [activeId, setActiveId] = useState<string | null>(
    () => seedItems(SEED_BASE_TIME)[0]?.id ?? null
  )
  const [busy, setBusy] = useState(false)
  const [overlay, setOverlay] = useState<OverlayMode>("heatmap")
  const [threshold, setThreshold] = useState(0.35)
  const [showRaw, setShowRaw] = useState(false)
  const [visitor, setVisitor] = useState(VISITOR_PLACEHOLDER)

  const fileRef = useRef<HTMLInputElement>(null)
  const reqId = useRef(0)
  const ownedUrls = useRef<Map<string, string>>(new Map())

  const active = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId]
  )
  const result = active?.cachedResult ?? null

  // Client-only: swap in the randomised visitor count and rebase the seeded
  // sample timestamps to "now". Kept out of the initial render so the server
  // and first client render stay identical (no hydration mismatch).
  useEffect(() => {
    setVisitor(String(1337 + Math.floor(Math.random() * 9999)).padStart(7, "0"))
    const now = Date.now()
    setItems((prev) =>
      prev.map((it, i) =>
        it.id.startsWith("seed_")
          ? { ...it, addedAt: now - (prev.length - i) * 60_000 }
          : it
      )
    )
  }, [])

  const updateItem = useCallback(
    (id: string, patch: Partial<LegacyItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
      )
    },
    []
  )

  const runInference = useCallback(
    async (item: LegacyItem) => {
      const rid = ++reqId.current
      setBusy(true)
      try {
        if (item.source.kind === "sample") {
          const sid = item.source.id
          const sample = SAMPLES_BY_ID[sid]
          if (sample) {
            await new Promise((r) =>
              setTimeout(r, 480 + ((sid.length * 30) % 400))
            )
            if (reqId.current !== rid) return
            updateItem(item.id, { cachedResult: sample.bakedResult })
            return
          }
        }
        const res = await mockInfer(
          item.source.kind === "file"
            ? { kind: "file", file: item.source.file }
            : { kind: "sample", id: item.source.id, size: 0 }
        )
        if (reqId.current !== rid) return
        updateItem(item.id, { cachedResult: res })
      } finally {
        if (reqId.current === rid) setBusy(false)
      }
    },
    [updateItem]
  )

  useEffect(() => {
    if (!active) {
      setBusy(false)
      return
    }
    if (active.cachedResult) {
      setBusy(false)
      reqId.current++
      return
    }
    void runInference(active)
  }, [active?.id])

  useEffect(() => {
    const alive = new Set(items.map((i) => i.id))
    items.forEach((i) => {
      if (i.source.kind === "file" && !i.isDicom) {
        ownedUrls.current.set(i.id, i.imageUrl)
      }
    })
    for (const [id, url] of ownedUrls.current) {
      if (!alive.has(id)) {
        URL.revokeObjectURL(url)
        ownedUrls.current.delete(id)
      }
    }
  }, [items])

  useEffect(() => {
    return () => {
      ownedUrls.current.forEach((url) => URL.revokeObjectURL(url))
      ownedUrls.current.clear()
    }
  }, [])

  const handleFile = useCallback((file: File) => {
    const looksDicom =
      /\.(dcm|dicom|dcm30)$/i.test(file.name) ||
      file.type === "application/dicom" ||
      file.type === "application/x-dicom"
    const looksImage = /^image\//.test(file.type)
    if (!looksDicom && !looksImage) {
      window.alert("ERROR: file type not supported. PNG/JPG/DICOM only.")
      return
    }
    const id = makeId()
    const url = looksDicom
      ? "/samples/cxr/0a0b773c653cea6653a1e02faf1566a5.png"
      : URL.createObjectURL(file)
    setItems((prev) => [
      {
        id,
        title: file.name,
        source: { kind: "file", file },
        imageUrl: url,
        isDicom: looksDicom,
        addedAt: Date.now(),
        cachedResult: null,
      },
      ...prev,
    ])
    setActiveId(id)
  }, [])

  const handleAddSample = useCallback((sample: Sample) => {
    const id = makeId()
    setItems((prev) => [
      {
        id,
        title: sample.title,
        source: { kind: "sample", id: sample.id },
        imageUrl: sample.imageUrl,
        isDicom: false,
        addedAt: Date.now(),
        cachedResult: sample.bakedResult,
      },
      ...prev,
    ])
    setActiveId(id)
  }, [])

  const handleRemove = useCallback(
    (id: string) => {
      if (!window.confirm("Are you sure you want to delete this entry?")) return
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id)
        if (activeId === id) setActiveId(next[0]?.id ?? null)
        return next
      })
    },
    [activeId]
  )

  const sampleIdsInItems = new Set(
    items
      .filter((i) => i.source.kind === "sample")
      .map((i) => (i.source.kind === "sample" ? i.source.id : ""))
  )
  const availableSamples = SAMPLES.filter(
    (s) => !sampleIdsInItems.has(s.id)
  )

  return (
    <div className="legacy-page">
      <style>{LEGACY_STYLES}</style>

      <div className="banner">
        <Font color="#FFFF00">~ ~ ~</Font>{" "}
        <b>MUCK :: Mock Chest X-Ray Classifier</b>{" "}
        <Font color="#FFFF00">~ ~ ~</Font>
        <br />
        <Font size={1}>
          Department of Computer Science · RMIT · last updated 2025-04-22
        </Font>
      </div>

      <table className="topnav" cellPadding={4} cellSpacing={0} border={0}>
        <tbody>
          <Tr>
            <Td>
              <b>NAVIGATION:</b> <a href="/legacy">[ HOME ]</a>{" "}
              <a href="#about">[ ABOUT ]</a>{" "}
              <a href="#data">[ DATA ]</a>{" "}
              <a href="#refs">[ REFS ]</a>{" "}
              <Link to="/">[ NEW UI &raquo; ]</Link>
            </Td>
            <Td align="right">
              <Font size={1}>
                You are visitor number{" "}
                <span className="counter">{visitor}</span>
              </Font>
            </Td>
          </Tr>
        </tbody>
      </table>

      <hr />

      <h1>
        Interpretable Multi-Label Chest X-Ray Classification{" "}
        <Font color="#CC0000">[NEW!]</Font>
      </h1>
      <p>
        <i>
          A prototype-based classifier with occurrence-map explanations. This
          page is a <b>mock</b> — predictions are simulated client-side. The
          fancy version is over <Link to="/">here</Link>, but my supervisor
          said it looked "too good", so behold the original.
        </i>
      </p>

      <hr />

      {/* ===================================================== */}
      {/* MAIN TABLE LAYOUT                                       */}
      {/* ===================================================== */}
      <table
        className="layout"
        cellPadding={6}
        cellSpacing={0}
        border={1}
        width="100%"
      >
        <tbody>
          <Tr>
            {/* LEFT COLUMN: HISTORY */}
            <Td valign="top" width="22%" bgcolor="#E0E0E0">
              <h2>1. Image Library</h2>
              <p>
                <b>Upload a CXR:</b>
                <br />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.dcm,.dicom,.dcm30,application/dicom,application/x-dicom"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                    e.target.value = ""
                  }}
                />
                <br />
                <Font size={1}>
                  (PNG, JPG, or DICOM <code>.dcm</code> file)
                </Font>
              </p>

              {availableSamples.length > 0 && (
                <p>
                  <b>Or pick a sample:</b>
                  <br />
                  {availableSamples.map((s) => (
                    <span key={s.id}>
                      &raquo;{" "}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          handleAddSample(s)
                        }}
                      >
                        {s.title}
                      </a>
                      <br />
                    </span>
                  ))}
                </p>
              )}

              <hr />

              <h3>History ({items.length})</h3>
              {items.length === 0 ? (
                <p>
                  <Font color="#888888">
                    <i>No entries.</i>
                  </Font>
                </p>
              ) : (
                <table
                  cellPadding={3}
                  cellSpacing={0}
                  border={1}
                  width="100%"
                  bgcolor="#FFFFFF"
                >
                  <tbody>
                    {items.map((it) => {
                      const isActive = it.id === activeId
                      const top = it.cachedResult?.predictions.find(
                        (p) => p.probability >= 0.35
                      )
                      return (
                        <Tr
                          key={it.id}
                          bgcolor={isActive ? "#FFFFCC" : undefined}
                        >
                          <Td>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setActiveId(it.id)
                              }}
                            >
                              {isActive ? <b>{it.title}</b> : it.title}
                            </a>
                            {it.isDicom && (
                              <>
                                {" "}
                                <Font
                                  size={1}
                                  color="#996600"
                                >
                                  [DCM]
                                </Font>
                              </>
                            )}
                            <br />
                            <Font size={1} color="#666666">
                              {top
                                ? `${top.label} (${fmtPct(top.probability)})`
                                : it.cachedResult
                                  ? "no finding"
                                  : "(pending)"}
                              <br />
                              {fmtTime(it.addedAt)}
                            </Font>
                            <br />
                            <Font size={1}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleRemove(it.id)
                                }}
                              >
                                [delete]
                              </a>
                            </Font>
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Td>

            {/* MIDDLE COLUMN: VIEWER */}
            <Td valign="top" bgcolor="#FFFFFF">
              <h2>2. Image Viewer</h2>
              {!active ? (
                <p>
                  <Font color="#888888">
                    <i>
                      No image selected. Please upload one or pick a sample
                      from the left.
                    </i>
                  </Font>
                </p>
              ) : (
                <>
                  <p>
                    <b>File:</b> <code>{active.title}</code>
                    {active.isDicom && (
                      <>
                        {" "}
                        <Font color="#996600">[DICOM stand-in]</Font>
                      </>
                    )}
                    <br />
                    <b>Status:</b>{" "}
                    {busy ? (
                      <Font color="#CC0000">
                        <Blink>RUNNING INFERENCE...</Blink>
                      </Font>
                    ) : result ? (
                      <Font color="#006600">OK</Font>
                    ) : (
                      <Font color="#888888">idle</Font>
                    )}
                    {result && (
                      <>
                        {" — "}
                        <Font size={1}>
                          model={result.modelVersion}, t=
                          {result.inferenceMs}ms
                        </Font>
                      </>
                    )}
                  </p>

                  <table
                    cellPadding={0}
                    cellSpacing={0}
                    border={2}
                    bgcolor="#000000"
                  >
                    <tbody>
                      <Tr>
                        <Td>
                          <ImageWithOverlay
                            imageUrl={active.imageUrl}
                            alt={active.title}
                            result={result}
                            overlay={overlay}
                            threshold={threshold}
                          />
                        </Td>
                      </Tr>
                    </tbody>
                  </table>

                  <p>
                    <b>Overlay:</b>{" "}
                    <label>
                      <input
                        type="radio"
                        name="ov"
                        checked={overlay === "heatmap"}
                        onChange={() => setOverlay("heatmap")}
                      />{" "}
                      heatmap
                    </label>{" "}
                    &nbsp;
                    <label>
                      <input
                        type="radio"
                        name="ov"
                        checked={overlay === "boxes"}
                        onChange={() => setOverlay("boxes")}
                      />{" "}
                      boxes
                    </label>{" "}
                    &nbsp;
                    <label>
                      <input
                        type="radio"
                        name="ov"
                        checked={overlay === "off"}
                        onChange={() => setOverlay("off")}
                      />{" "}
                      off
                    </label>
                    <br />
                    <b>Threshold:</b>{" "}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={threshold}
                      onChange={(e) =>
                        setThreshold(parseFloat(e.target.value))
                      }
                    />{" "}
                    <code>{threshold.toFixed(2)}</code>
                  </p>
                </>
              )}
            </Td>

            {/* RIGHT COLUMN: PREDICTIONS */}
            <Td valign="top" width="34%" bgcolor="#F5F5DC">
              <h2>3. Predictions</h2>
              {!result ? (
                <p>
                  <Font color="#888888">
                    <i>
                      {busy
                        ? "Computing predictions..."
                        : "Predictions will appear here."}
                    </i>
                  </Font>
                </p>
              ) : (
                <PredictionsTable
                  result={result}
                  threshold={threshold}
                />
              )}
            </Td>
          </Tr>
        </tbody>
      </table>

      {/* ===================================================== */}
      {/* RAW JSON                                                */}
      {/* ===================================================== */}
      <hr />
      <h2>4. Raw API Response</h2>
      <p>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setShowRaw((s) => !s)
          }}
        >
          {showRaw ? "[ - hide ]" : "[ + show ]"}
        </a>
      </p>
      {showRaw && (
        <pre className="raw">
          {result ? JSON.stringify(result, null, 2) : "(no result yet)"}
        </pre>
      )}

      {/* ===================================================== */}
      {/* ABOUT                                                   */}
      {/* ===================================================== */}
      <hr />
      <a id="about" />
      <h2>About this project</h2>
      <p>
        MUCK is an interpretable, multi-label chest X-ray classifier built on
        top of <b>XProtoNet</b>-style prototype learning with{" "}
        <b>occurrence maps</b>. The goal is computer-aided diagnosis that is{" "}
        <i>not a black box</i> — every prediction comes with both a spatial
        explanation and a set of nearest training prototypes.
      </p>
      <ul>
        <li>14 pathology labels + "No finding" (VinDr-CXR taxonomy).</li>
        <li>Occurrence maps drawn as soft heatmaps over anatomy.</li>
        <li>Bounding boxes from radiologist annotations where available.</li>
        <li>Top-k nearest training prototypes per class.</li>
      </ul>

      <a id="data" />
      <h2>Datasets</h2>
      <table cellPadding={4} cellSpacing={0} border={1}>
        <tbody>
          <Tr bgcolor="#C0C0C0">
            <Th align="left">Dataset</Th>
            <Th align="left">Images</Th>
            <Th align="left">Labels</Th>
            <Th align="left">Bbox?</Th>
          </Tr>
          <Tr>
            <Td>VinDr-CXR</Td>
            <Td>18,000</Td>
            <Td>14 + NF</Td>
            <Td>yes</Td>
          </Tr>
          <Tr>
            <Td>NIH ChestX-ray14</Td>
            <Td>112,120</Td>
            <Td>14</Td>
            <Td>partial</Td>
          </Tr>
          <Tr>
            <Td>CheXpert</Td>
            <Td>224,316</Td>
            <Td>14</Td>
            <Td>no</Td>
          </Tr>
          <Tr>
            <Td>PadChest</Td>
            <Td>160,868</Td>
            <Td>~190</Td>
            <Td>no</Td>
          </Tr>
        </tbody>
      </table>

      <a id="refs" />
      <h2>References</h2>
      <ol>
        <li>
          Kim et al., <i>XProtoNet: Diagnosis in Chest Radiography with
          Global and Local Explanations</i>, CVPR 2021.
        </li>
        <li>
          Chen et al., <i>This Looks Like That: Deep Learning for
          Interpretable Image Recognition</i>, NeurIPS 2019.
        </li>
        <li>
          Nguyen et al., <i>VinDr-CXR: An open dataset of chest X-rays with
          radiologist annotations</i>, Scientific Data 2022.
        </li>
      </ol>

      <hr />
      <table width="100%">
        <tbody>
          <Tr>
            <Td align="left">
              <Font size={1}>
                © 2026 Capstone Project · RMIT SSET ·{" "}
                <a href="mailto:noreply@example.org">webmaster</a>
              </Font>
            </Td>
            <Td align="right">
              <Font size={1}>
                <i>Best viewed in Netscape Navigator 4.0 at 1024×768.</i>
              </Font>
            </Td>
          </Tr>
        </tbody>
      </table>
    </div>
  )
}

// =====================================================================
// IMAGE + OVERLAYS
// =====================================================================

function ImageWithOverlay({
  imageUrl,
  alt,
  result,
  overlay,
  threshold,
}: {
  imageUrl: string
  alt: string
  result: InferenceResult | null
  overlay: OverlayMode
  threshold: number
}) {
  const [aspect, setAspect] = useState(3 / 4)
  return (
    <div
      style={{
        position: "relative",
        width: 480,
        maxWidth: "100%",
        aspectRatio: aspect,
        background: "#000",
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget
          if (el.naturalWidth && el.naturalHeight) {
            setAspect(el.naturalWidth / el.naturalHeight)
          }
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
      {result && overlay === "heatmap" && (
        <HeatmapSvg result={result} threshold={threshold} />
      )}
      {result && overlay === "boxes" && (
        <BoxesSvg result={result} threshold={threshold} />
      )}
    </div>
  )
}

function HeatmapSvg({
  result,
  threshold,
}: {
  result: InferenceResult
  threshold: number
}) {
  const blobs: Array<{
    labelId: number
    cx: number
    cy: number
    rx: number
    ry: number
    intensity: number
    color: string
  }> = []
  for (const [id, list] of Object.entries(result.occurrenceMaps)) {
    const labelId = Number(id)
    const pred = result.predictions.find((p) => p.labelId === labelId)
    if (!pred || pred.probability < threshold) continue
    if (labelId === NO_FINDING_ID) continue
    const color = LABELS_BY_ID[labelId]?.color ?? "oklch(0.7 0.15 30)"
    for (const b of list) {
      blobs.push({ labelId, ...b, color })
    }
  }
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    >
      <defs>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`lg-grad-${i}`}>
            <stop offset="0%" stopColor={b.color} stopOpacity={0.85} />
            <stop offset="100%" stopColor={b.color} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {blobs.map((b, i) => (
        <ellipse
          key={i}
          cx={b.cx * 100}
          cy={b.cy * 100}
          rx={b.rx * 100}
          ry={b.ry * 100}
          fill={`url(#lg-grad-${i})`}
          opacity={Math.max(0.4, b.intensity)}
        />
      ))}
    </svg>
  )
}

function BoxesSvg({
  result,
  threshold,
}: {
  result: InferenceResult
  threshold: number
}) {
  const boxes = result.predictions.filter(
    (p) =>
      p.bbox &&
      p.probability >= threshold &&
      p.labelId !== NO_FINDING_ID
  )
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {boxes.map((p) => {
        const [x, y, w, h] = p.bbox!
        const color = LABELS_BY_ID[p.labelId]?.color ?? "#FF00FF"
        return (
          <g key={p.labelId}>
            <rect
              x={x * 100}
              y={y * 100}
              width={w * 100}
              height={h * 100}
              fill="none"
              stroke={color}
              strokeWidth={0.4}
              strokeDasharray="1,0.5"
            />
            <text
              x={x * 100 + 0.5}
              y={y * 100 - 0.5}
              fontSize={3}
              fill={color}
              fontFamily="monospace"
            >
              {LABELS_BY_ID[p.labelId]?.shortName ?? p.label} (
              {Math.round(p.probability * 100)}%)
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// =====================================================================
// PREDICTIONS TABLE
// =====================================================================

function PredictionsTable({
  result,
  threshold,
}: {
  result: InferenceResult
  threshold: number
}) {
  const noFinding = result.predictions.find(
    (p) => p.labelId === NO_FINDING_ID
  )
  const topPath = result.predictions.find(
    (p) => p.labelId !== NO_FINDING_ID
  )
  const noFindingDominates =
    noFinding !== undefined &&
    (!topPath || noFinding.probability > topPath.probability)
  const sorted = result.predictions.filter(
    (p) => !(noFindingDominates && p.labelId === NO_FINDING_ID)
  )
  const aboveCount = sorted.filter(
    (p) => p.labelId !== NO_FINDING_ID && p.probability >= threshold
  ).length

  return (
    <>
      {noFindingDominates && noFinding && (
        <p
          style={{
            border: "2px solid #006600",
            background: "#CCFFCC",
            padding: 6,
          }}
        >
          <b>NO FINDING — {fmtPct(noFinding.probability)}</b>
          <br />
          <Font size={1}>
            Model is confident this study has no major pathology.
          </Font>
        </p>
      )}
      <p>
        <Font size={1}>
          {aboveCount} above threshold &middot; {sorted.length} labels total
        </Font>
      </p>
      <table
        cellPadding={3}
        cellSpacing={0}
        border={1}
        width="100%"
        bgcolor="#FFFFFF"
      >
        <Thead bgcolor="#C0C0C0">
          <Tr>
            <Th align="left">#</Th>
            <Th align="left">Label</Th>
            <Th align="left">Bar</Th>
            <Th align="right">P</Th>
          </Tr>
        </Thead>
        <tbody>
          {sorted.map((p, i) => {
            const isAbove = p.probability >= threshold
            const isNF = p.labelId === NO_FINDING_ID
            return (
              <Tr
                key={p.labelId}
                style={{
                  opacity: isAbove || isNF ? 1 : 0.55,
                }}
              >
                <Td>
                  <Font size={1}>{i + 1}.</Font>
                </Td>
                <Td>
                  {isAbove && !isNF ? <b>{p.label}</b> : p.label}
                </Td>
                <Td>
                  <code style={{ fontSize: 11 }}>
                    {asciiBar(p.probability)}
                  </code>
                </Td>
                <Td align="right">
                  <code>{fmtPct(p.probability)}</code>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

// =====================================================================
// STYLES (deliberately Web 1.0)
// =====================================================================

const LEGACY_STYLES = `
.legacy-page {
  font-family: "Times New Roman", Times, serif;
  font-size: 14px;
  color: #000;
  background: #C0C0C0;
  padding: 12px;
  min-height: 100svh;
}
.legacy-page a { color: #0000EE; text-decoration: underline; }
.legacy-page a:visited { color: #551A8B; }
.legacy-page a:hover { background: #FFFF00; }
.legacy-page h1 {
  font-family: "Comic Sans MS", "Times New Roman", serif;
  font-size: 26px;
  margin: 8px 0;
  color: #000080;
}
.legacy-page h2 {
  font-size: 18px;
  margin: 12px 0 6px;
  color: #000080;
  border-bottom: 1px dashed #888;
}
.legacy-page h3 {
  font-size: 15px;
  margin: 10px 0 4px;
  color: #003366;
}
.legacy-page hr {
  border: 0;
  border-top: 1px solid #555;
  margin: 12px 0;
}
.legacy-page p { margin: 6px 0; line-height: 1.45; }
.legacy-page code, .legacy-page pre {
  font-family: "Courier New", Courier, monospace;
}
.legacy-page pre.raw {
  background: #000;
  color: #00FF00;
  padding: 8px;
  font-size: 11px;
  overflow: auto;
  max-height: 320px;
  border: 2px inset #888;
}
.legacy-page .banner {
  background: #000080;
  color: #FFFFFF;
  text-align: center;
  padding: 8px;
  border: 3px ridge #C0C0C0;
  font-size: 18px;
  letter-spacing: 1px;
}
.legacy-page .topnav {
  margin-top: 6px;
  width: 100%;
  background: #E0E0E0;
  border: 1px solid #888;
}
.legacy-page .counter {
  display: inline-block;
  padding: 1px 6px;
  background: #000;
  color: #00FF00;
  font-family: "Courier New", monospace;
  letter-spacing: 2px;
  border: 1px inset #888;
}
.legacy-page table.layout { background: #FFFFFF; }
.legacy-page input[type="file"] {
  font-family: inherit;
  font-size: 12px;
}
.legacy-page input[type="range"] {
  vertical-align: middle;
}
.legacy-page button, .legacy-page input[type="button"], .legacy-page input[type="submit"] {
  font-family: "Times New Roman", Times, serif;
  font-size: 13px;
  background: #DDD;
  border: 2px outset #DDD;
  padding: 2px 8px;
  cursor: pointer;
}
.legacy-page button:active {
  border-style: inset;
}
.legacy-page ul, .legacy-page ol { margin: 6px 0 6px 24px; }
.legacy-page blink {
  animation: blink-anim 1s step-start infinite;
}
@keyframes blink-anim {
  50% { opacity: 0; }
}
`
