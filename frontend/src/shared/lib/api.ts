import type { Opening, Placement, Product, RoomCreate, RoomResponse, StyleSuggestion } from "@/shared/types";

// Points at the FastAPI service in backend/app. Override with
// VITE_API_BASE_URL in .env if it's not running on the default port.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers:
        init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json", ...init?.headers }
          : init?.headers,
    });
  } catch {
    throw new ApiError(
      `Couldn't reach the RoomSpace API at ${BASE_URL}. Is the backend running (uvicorn app.main:app)?`
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(detail || res.statusText, res.status);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as Promise<T>;
}

async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(`Couldn't reach the RoomSpace API at ${BASE_URL}.`);
  }
  if (!res.ok) {
    throw new ApiError((await res.text().catch(() => "")) || res.statusText, res.status);
  }
  return res.blob();
}

export const api = {
  health: () => request<{ status: string; service: string }>("/health"),

  createRoom: (room: RoomCreate) =>
    request<RoomResponse>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(room),
    }),

  setOpenings: (roomId: string, openings: Opening[]) =>
    request<RoomResponse>(`/api/rooms/${roomId}/openings`, {
      method: "PUT",
      body: JSON.stringify(openings),
    }),

  /** Several photos of the same room; the backend merges detections. */
  analyzePhotos: (roomId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("photos", file);
    return request<RoomResponse>(`/api/rooms/${roomId}/photos`, {
      method: "POST",
      body: form,
    });
  },

  /** Zero-shot CLIP theme ranking and wall/floor colours from the photos (needs the backend's ML extras). */
  styleSuggestion: (roomId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("photos", file);
    return request<StyleSuggestion>(`/api/rooms/${roomId}/style-suggestion`, { method: "POST", body: form });
  },

  /** Closest known commands to a free-form phrasing (local sentence model on the backend). */
  interpretCommand: (text: string, candidates: string[]) =>
    request<{ matches: { candidate: string; score: number }[] }>(`/api/commands/interpret`, {
      method: "POST",
      body: JSON.stringify({ text, candidates }),
    }),

  validateLayout: (roomId: string, placements: Placement[]) =>
    request<{ feasible: boolean; violations: string[]; svg: string }>(
      `/api/rooms/${roomId}/validate-layout`,
      { method: "POST", body: JSON.stringify(placements) }
    ),

  conceptImage: (
    roomId: string,
    payload: { placements: Placement[]; selections: Record<string, Product>; theme?: string }
  ) =>
    requestBlob(`/api/rooms/${roomId}/concept-image`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const API_BASE_URL = BASE_URL;
