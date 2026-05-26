// src/lib/api.js
import axios from "axios";

export const API_BASE =
  process.env.REACT_APP_API_BASE || "http://localhost:8000/api";

// Backend bazen aynı host'ta, bazen ayrı domain'de olabilir.
// Görsel URL'leri "/uploads/..." olarak dönüyor; backend ile aynı origin'de değilsek prefix gerekir.
const apiUrl = new URL(API_BASE, window.location.origin);
export const BACKEND_ORIGIN = `${apiUrl.protocol}//${apiUrl.host}`;

/**
 * Görsel path'ini tarayıcı için kullanılabilir URL'ye çevirir.
 *  - http(s)://, data:, blob:               → olduğu gibi
 *  - /uploads/...  (backend'den yüklenen)   → BACKEND_ORIGIN + path
 *  - /images/... , /static/... (frontend public) → olduğu gibi
 *  - "kahvalti.jpg" (eski mock.js formatı, sadece dosya adı) → /images/kahvalti.jpg
 */
export const resolveImageUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    return `${BACKEND_ORIGIN}${path}`;
  }
  if (path.startsWith("/")) return path;
  // Sadece dosya adıysa public/images altında olduğunu varsay (eski mock.js davranışı)
  return `/images/${path}`;
};

export const api = axios.create({ baseURL: API_BASE });

export const uploadImage = async (file, kind = "menu", onProgress) => {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await api.post("/upload/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return res.data; // { url, filename, bytes }
};

export const deleteUploadedImage = async (path) => {
  try {
    await api.delete("/upload/image", { params: { path } });
  } catch {
    /* sessiz geç */
  }
};
