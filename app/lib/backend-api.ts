export type UserResponse = {
  id: string
  email: string
  created_at: string
}

export type AuthResponse = {
  session_token: string
  expires_at: string
  user: UserResponse
}

export type PredictionSummary = {
  id: string
  image_id: string
  original_filename: string
  created_at: string
  duration_ms: number
  top_k_protos: number
}

export type PredictionDetail = {
  id: string
  image_id: string
  created_at: string
  duration_ms: number
  response: BackendPredictionResponse
}

export type PredictionJob = {
  id: string
  status:
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
    | string
  image_id: string
  prediction_id: string | null
  original_filename?: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  top_k_protos: number
  include_timing: boolean
  response: BackendPredictionResponse | null
}

export type BackendPrototype = {
  prototype_idx?: number | string | null
  similarity?: number | null
  heatmap_base64?: string | null
  source_image_path?: string | null
  source_image_id?: string | null
  source_image_url?: string | null
  source_patch_h?: number | null
  source_patch_w?: number | null
  source_distance?: number | null
}

export type BackendModelPrediction = {
  class_name?: string
  label?: string
  probability?: number
  predicted?: boolean
  threshold_margin?: number
  threshold_borderline?: boolean
  reasoning?: string
  occurrence_map_base64?: string | null
  prototypes?: BackendPrototype[]
}

export type BackendPredictionResponse = {
  filename?: string
  model_version?: string
  threshold?: number
  predictions?: BackendModelPrediction[]
  timings_ms?: Record<string, number>
  backend?: {
    image_id?: string
    prediction_id?: string
    duration_ms?: number
  }
  [key: string]: unknown
}

type ApiClientOptions = {
  baseUrl?: string
  getToken?: () => string | null
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
  auth?: boolean
}

const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ""
  ) || "http://127.0.0.1:8080"

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

export function getDefaultApiBaseUrl() {
  return DEFAULT_API_BASE_URL
}

export function createBackendApiClient({
  baseUrl = DEFAULT_API_BASE_URL,
  getToken = () => null,
  onUnauthorized,
  fetchImpl = fetch,
}: ApiClientOptions = {}) {
  const root = baseUrl.replace(/\/$/, "")

  async function request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) }
    const token = getToken()
    if (options.auth !== false && token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers,
    })
    if (!response.ok) {
      const payload = await readPayload(response)
      if (response.status === 401) onUnauthorized?.()
      throw new ApiError(
        errorMessage(payload, response.statusText),
        response.status,
        payload
      )
    }
    return readPayload(response) as Promise<T>
  }

  async function jsonRequest<T>(path: string, body: unknown, auth = false) {
    return request<T>(path, {
      method: "POST",
      auth,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  return {
    baseUrl: root,
    apiUrl(path: string) {
      return `${root}${path.startsWith("/") ? path : `/${path}`}`
    },
    register(email: string, password: string) {
      return jsonRequest<AuthResponse>(
        "/api/auth/register",
        { email, password },
        false
      )
    },
    login(email: string, password: string) {
      return jsonRequest<AuthResponse>(
        "/api/auth/login",
        { email, password },
        false
      )
    },
    logout() {
      return request<{ status: string }>("/api/auth/logout", { method: "POST" })
    },
    me() {
      return request<UserResponse>("/api/me")
    },
    createPredictionJob(
      file: File,
      opts: { topKProtos?: number; includeTiming?: boolean } = {}
    ) {
      const form = new FormData()
      form.append("file", file)
      form.append("top_k_protos", String(opts.topKProtos ?? 3))
      form.append("include_timing", String(opts.includeTiming ?? false))
      return request<PredictionJob>("/api/prediction-jobs", {
        method: "POST",
        body: form,
      })
    },
    getPredictionJob(jobId: string) {
      return request<PredictionJob>(
        `/api/prediction-jobs/${encodeURIComponent(jobId)}`
      )
    },
    listPredictionJobs(limit = 50) {
      return request<PredictionJob[]>(`/api/prediction-jobs?limit=${limit}`)
    },
    listPredictions(limit = 50) {
      return request<PredictionSummary[]>(`/api/predictions?limit=${limit}`)
    },
    getPrediction(predictionId: string) {
      return request<PredictionDetail>(
        `/api/predictions/${encodeURIComponent(predictionId)}`
      )
    },
    async fetchImageBlob(imageId: string) {
      const token = getToken()
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetchImpl(
        `${root}/api/images/${encodeURIComponent(imageId)}`,
        {
          headers,
        }
      )
      if (!response.ok) {
        const payload = await readPayload(response)
        if (response.status === 401) onUnauthorized?.()
        throw new ApiError(
          errorMessage(payload, response.statusText),
          response.status,
          payload
        )
      }
      return response.blob()
    },
  }
}

async function readPayload(response: Response) {
  if (response.status === 204) return null
  const contentType = response.headers.get("Content-Type") ?? ""
  if (contentType.includes("application/json")) {
    return response.json()
  }
  return response.text()
}

function errorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload) return payload
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message: unknown }).message
      if (typeof message === "string") return message
    }
  }
  return fallback || "Request failed"
}
