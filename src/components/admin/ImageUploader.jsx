// src/components/admin/ImageUploader.jsx
import React, { useRef, useState, useCallback } from "react";
import { uploadImage, resolveImageUrl } from "../../lib/api";

/**
 * Tek bir görseli yönetir: önizleme, dosya seçme, sürükleyip bırakma, yükleme.
 *
 * Props:
 *   value          : string         (mevcut görsel yolu — /uploads/... veya /images/...)
 *   onChange(url)  : function       (yükleme bittiğinde çağrılır)
 *   kind           : "menu"|"category"
 *   placeholder    : ReactNode (boşken gösterilecek metin)
 *   aspect         : "square"|"wide" (görsel oranı)
 */
const ImageUploader = ({
  value = "",
  onChange,
  kind = "menu",
  placeholder = "Görsel",
  aspect = "square",
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Sadece görsel dosyası yükleyebilirsin.");
        return;
      }
      setError("");
      setUploading(true);
      setProgress(0);
      try {
        const data = await uploadImage(file, kind, (p) => setProgress(p));
        onChange?.(data.url);
      } catch (err) {
        const msg =
          err.response?.data?.detail ||
          err.message ||
          "Görsel yüklenirken hata oluştu.";
        setError(msg);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [kind, onChange]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFiles([file]);
          return;
        }
      }
    }
  };

  const onClear = (e) => {
    e.stopPropagation();
    onChange?.("");
  };

  const imgSrc = value ? resolveImageUrl(value) : "";

  return (
    <div className={`img-up img-up-${aspect}`}>
      <div
        className={`img-up-box ${dragOver ? "is-drag" : ""} ${
          uploading ? "is-loading" : ""
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={0}
        role="button"
        aria-label="Görsel yükle"
      >
        {imgSrc ? (
          <>
            <img
              src={imgSrc}
              alt=""
              className="img-up-preview"
              onError={(e) => {
                e.currentTarget.style.opacity = "0.25";
              }}
            />
            <div className="img-up-overlay">
              <span>Değiştir</span>
            </div>
            <button
              type="button"
              className="img-up-clear"
              onClick={onClear}
              title="Görseli kaldır"
            >
              ×
            </button>
          </>
        ) : (
          <div className="img-up-empty">
            <div className="img-up-icon">⬆</div>
            <div className="img-up-text">{placeholder}</div>
            <div className="img-up-hint">Tıkla, sürükle veya yapıştır</div>
          </div>
        )}

        {uploading && (
          <div className="img-up-progress">
            <div
              className="img-up-progress-bar"
              style={{ width: `${progress}%` }}
            />
            <span className="img-up-progress-text">{progress}%</span>
          </div>
        )}
      </div>

      {error && <div className="img-up-error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default ImageUploader;
