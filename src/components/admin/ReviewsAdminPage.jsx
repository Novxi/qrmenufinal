// src/components/admin/ReviewsAdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";

import AdminLayout from "./AdminLayout";
import AdminLogin, { isAdminAuthed } from "./AdminLogin";
import "./admin.css";
import {
  getReviews,
  deleteReview,
  getFavoriteSuggestions,
  deleteFavoriteSuggestion,
} from "../../lib/community";

const fmtCreated = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 16);
  }
};

const Stars = ({ value = 0 }) => (
  <span className="rva-stars" aria-label={`${value} yıldız`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={n <= value ? "is-on" : ""}>
        ★
      </span>
    ))}
  </span>
);

const scopeLabel = (s) =>
  s === "kir_kahvesi" ? "Kır Kahvesi" : s === "restaurant" ? "Restoran" : s || "—";

const ReviewsAdminPage = () => {
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [tab, setTab] = useState("reviews");

  const [reviews, setReviews] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [rv, fs] = await Promise.allSettled([
        getReviews(),
        getFavoriteSuggestions(),
      ]);

      if (rv.status === "fulfilled") {
        const sorted = [...rv.value].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        setReviews(sorted);
      } else {
        setReviews([]);
      }

      if (fs.status === "fulfilled") {
        const sorted = [...fs.value].sort(
          (a, b) =>
            (Number(b.count) || 1) - (Number(a.count) || 1) ||
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        setSuggestions(sorted);
      } else {
        setSuggestions([]);
      }

      if (rv.status === "rejected" && fs.status === "rejected") {
        setError(
          "Veriler alınamadı. Backend'de /api/reviews ve /api/favorite-suggestions uçlarının tanımlı olduğundan emin olun."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) fetchAll();
    else setLoading(false);
  }, [authed]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const visibleReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const visibleSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) =>
      (s.item_name || "").toLowerCase().includes(q)
    );
  }, [suggestions, search]);

  const handleDeleteReview = async (id) => {
    if (!window.confirm("Bu yorumu silmek istediğine emin misin?")) return;
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Silinirken bir hata oluştu.");
    }
  };

  const handleDeleteSuggestion = async (id) => {
    if (!window.confirm("Bu favori önerisini silmek istediğine emin misin?"))
      return;
    try {
      await deleteFavoriteSuggestion(id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Silinirken bir hata oluştu.");
    }
  };

  const navCounts = useMemo(
    () => ({ "/admin/reviews": reviews.length }),
    [reviews.length]
  );

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  if (loading) {
    return (
      <div className="admin-loader">
        <span className="admin-spinner" />
        <span style={{ marginLeft: 12 }}>Yorumlar Yükleniyor</span>
      </div>
    );
  }

  const headerActions = (
    <button
      type="button"
      className="admin-btn admin-btn-primary"
      onClick={fetchAll}
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="admin-spinner" /> Yenileniyor
        </>
      ) : (
        "Yenile"
      )}
    </button>
  );

  return (
    <AdminLayout
      title="Yorumlar & Favoriler"
      subtitle="Müşteri yorumlarını ve müşterilerin önerdiği favori lezzetleri buradan takip et."
      actions={headerActions}
      navCounts={navCounts}
    >
      {error && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="rva-stats">
        <div className="rva-stat is-highlight">
          <div className="rva-stat-label">Ortalama Puan</div>
          <div className="rva-stat-value">
            {stats.count ? stats.avg.toFixed(1) : "—"}{" "}
            {stats.count > 0 && <Stars value={Math.round(stats.avg)} />}
          </div>
        </div>
        <div className="rva-stat">
          <div className="rva-stat-label">Toplam Yorum</div>
          <div className="rva-stat-value">{stats.count}</div>
        </div>
        <div className="rva-stat">
          <div className="rva-stat-label">Favori Önerisi</div>
          <div className="rva-stat-value">{suggestions.length}</div>
        </div>
      </div>

      <div className="rva-toolbar">
        <div className="admin-segment">
          <button
            onClick={() => setTab("reviews")}
            className={tab === "reviews" ? "is-active" : ""}
          >
            Yorumlar ({reviews.length})
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={tab === "favorites" ? "is-active" : ""}
          >
            Favori Önerileri ({suggestions.length})
          </button>
        </div>

        <div className="admin-search" style={{ flex: 1, minWidth: 220 }}>
          <span className="admin-search-icon">⌕</span>
          <input
            className="admin-input"
            placeholder={
              tab === "reviews" ? "İsim veya yorum ara…" : "Ürün adı ara…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {tab === "reviews" ? (
        visibleReviews.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">💬</div>
            <div className="admin-empty-title">
              {search ? "Eşleşen yorum yok" : "Henüz yorum yok"}
            </div>
          </div>
        ) : (
          <div className="rva-list">
            {visibleReviews.map((r) => (
              <div key={r.id} className="rva-card">
                <div className="rva-card-main">
                  <div className="rva-card-head">
                    <span className="rva-name">{r.name || "Misafir"}</span>
                    <Stars value={Number(r.rating) || 0} />
                  </div>
                  <p className="rva-comment">{r.comment}</p>
                  {r.created_at && (
                    <div className="rva-meta">{fmtCreated(r.created_at)}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  onClick={() => handleDeleteReview(r.id)}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )
      ) : visibleSuggestions.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">💛</div>
          <div className="admin-empty-title">
            {search
              ? "Eşleşen öneri yok"
              : "Müşteriler henüz favori önermedi"}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--admin-text-muted)",
            }}
          >
            Müşteriler menüde bir ürünü "Favori öner" ile işaretlediğinde burada
            görünür. Menü Yönetimi'nden ürünleri favori olarak işaretleyerek
            müşteriye "Favoriler" grubunu gösterebilirsin.
          </div>
        </div>
      ) : (
        <div className="rva-list">
          {visibleSuggestions.map((s) => (
            <div key={s.id} className="rva-card">
              <div className="rva-card-main">
                <div className="rva-card-head">
                  <span className="rva-name">{s.item_name || "—"}</span>
                  <span className="rva-count-pill">
                    💛 {Number(s.count) || 1} öneri
                  </span>
                </div>
                <div className="rva-meta">
                  <span className="rva-scope-pill">{scopeLabel(s.scope)}</span>
                  {s.category_name && (
                    <span style={{ marginLeft: 10 }}>{s.category_name}</span>
                  )}
                  {s.created_at && (
                    <span style={{ marginLeft: 10 }}>
                      • {fmtCreated(s.created_at)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={() => handleDeleteSuggestion(s.id)}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .rva-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }
        .rva-stat {
          padding: 18px 20px;
          background: var(--admin-surface);
          border: 1px solid var(--admin-gold-faint);
          border-radius: 14px;
        }
        .rva-stat.is-highlight {
          background: linear-gradient(135deg, rgba(214, 196, 142, 0.16), rgba(214, 196, 142, 0.04));
          border-color: rgba(214, 196, 142, 0.35);
        }
        .rva-stat-label {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--admin-text-dim);
          margin-bottom: 8px;
        }
        .rva-stat-value {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 600;
          color: var(--admin-gold);
          line-height: 1;
        }
        .rva-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
        }
        .rva-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .rva-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          background: var(--admin-surface-3);
          border: 1px solid var(--admin-gold-faint);
          border-radius: 14px;
          transition: border-color 0.2s ease;
        }
        .rva-card:hover { border-color: var(--admin-gold-muted); }
        .rva-card-main { min-width: 0; flex: 1; }
        .rva-card-head {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .rva-name {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          color: var(--admin-text);
          font-weight: 500;
        }
        .rva-comment {
          font-size: 14px;
          line-height: 1.6;
          color: var(--admin-text-muted);
          margin: 0 0 8px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .rva-meta {
          font-size: 11px;
          letter-spacing: 0.5px;
          color: var(--admin-text-dim);
        }
        .rva-stars { white-space: nowrap; letter-spacing: 1px; font-size: 15px; }
        .rva-stars span { color: rgba(245, 236, 209, 0.2); }
        .rva-stars span.is-on { color: #e6c25a; }
        .rva-count-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(214, 196, 142, 0.1);
          border: 1px solid var(--admin-gold-faint);
          color: var(--admin-gold);
          font-size: 12px;
          font-weight: 600;
        }
        .rva-scope-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 9px;
          border-radius: 999px;
          background: rgba(214, 196, 142, 0.08);
          border: 1px solid var(--admin-gold-faint);
          color: var(--admin-gold);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        @media (max-width: 880px) {
          .rva-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  );
};

export default ReviewsAdminPage;
