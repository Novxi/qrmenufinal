// src/hooks/useMenuData.js
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { menuData as fallbackMenu } from "../mock";

const FALLBACK_KIR_CATS = new Set([
  "Sıcak İçecekler",
  "Soğuk İçecekler",
  "Tatlılar",
  "Fast Food",
  "Hot Drinks",
  "Cold Drinks",
  "Desserts",
]);

function buildFallback(scope) {
  if (scope !== "kir_kahvesi") return fallbackMenu;
  const out = {};
  for (const [lang, ldata] of Object.entries(fallbackMenu || {})) {
    out[lang] = {
      categories: (ldata?.categories || []).filter((c) =>
        FALLBACK_KIR_CATS.has(c?.name)
      ),
    };
  }
  return out;
}

/**
 * Backend'den canlı menüyü çeker.
 * scope: 'restaurant' (default) veya 'kir_kahvesi'
 * Hata olursa mock.js'i fallback olarak kullanır.
 */
export function useMenuData(scope = "restaurant") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const res = await api.get(`/menu/${scope}`);
        if (cancelled) return;
        setData(res.data);
      } catch (err) {
        // Backend henüz scope-aware değilse legacy /api/menu'ye düş
        if (err.response?.status === 404) {
          try {
            const legacy = await api.get(`/menu`);
            if (cancelled) return;
            if (scope === "kir_kahvesi") {
              // Eski tek-menü backend: kır kahvesi tab'ını filtreyle simüle et
              const out = {};
              for (const [lang, ldata] of Object.entries(legacy.data || {})) {
                out[lang] = {
                  categories: (ldata?.categories || []).filter((c) =>
                    FALLBACK_KIR_CATS.has(c?.name)
                  ),
                };
              }
              setData(out);
            } else {
              setData(legacy.data);
            }
            return;
          } catch (_) {
            // legacy de başarısız → sonraki adımda mock fallback
          }
        }
        if (cancelled) return;
        setError(err.message || "Menü yüklenemedi");
        setData(buildFallback(scope));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  return { menu: data, loading, error };
}
