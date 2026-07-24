import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const feRoot = resolve(scriptDir, "..")
const clientBuildDir = join(feRoot, "build", "client")
const indexHtml = join(clientBuildDir, "index.html")

const backendRoot = resolve(
  process.env.BE_DIR || process.env.BACKEND_DIR || join(feRoot, "..", "be")
)
const staticDir = join(backendRoot, "static")

if (!existsSync(indexHtml)) {
  console.error(
    "Missing SPA build at fe/build/client/index.html.\n" +
      "Ensure react-router.config.ts has ssr: false, then rebuild."
  )
  process.exit(1)
}

if (!existsSync(backendRoot)) {
  console.error(
    `Backend repo not found at ${backendRoot}.\n` +
      "Expected a sibling ../be checkout, or set BE_DIR to the backend root."
  )
  process.exit(1)
}

// Keep BE-only extras (e.g. samples/cxr PNGs) that are not part of the FE public build.
const preserveRelativePaths = ["samples/cxr"]
const backupRoot = mkdtempSync(join(tmpdir(), "cxr-fe-stage-"))

try {
  for (const relativePath of preserveRelativePaths) {
    const source = join(staticDir, relativePath)
    if (existsSync(source) && statSync(source).isDirectory()) {
      const destination = join(backupRoot, relativePath)
      mkdirSync(dirname(destination), { recursive: true })
      cpSync(source, destination, { recursive: true })
    }
  }

  rmSync(staticDir, { recursive: true, force: true })
  mkdirSync(staticDir, { recursive: true })
  cpSync(clientBuildDir, staticDir, { recursive: true })

  for (const relativePath of preserveRelativePaths) {
    const preserved = join(backupRoot, relativePath)
    const destination = join(staticDir, relativePath)
    if (!existsSync(preserved)) {
      continue
    }
    if (existsSync(destination) && readdirSync(destination).length > 0) {
      continue
    }
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(preserved, destination, { recursive: true })
    console.log(`Preserved BE-only assets: ${relativePath}`)
  }
} finally {
  rmSync(backupRoot, { recursive: true, force: true })
}

console.log(`Staged frontend build to ${staticDir}`)
