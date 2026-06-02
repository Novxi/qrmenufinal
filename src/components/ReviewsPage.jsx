// src/components/ReviewsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getReviews, createReview } from "../lib/community";

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
};

const Stars = ({ value = 0, size = 16 }) => (
  <span className="rv-stars-static" style={{ fontSize: size }} aria-label={`${value} yıldız`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={n <= value ? "is-on" : ""}>
        ★
      </span>
    ))}
  </span>
);

const ReviewsPage = () => {
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [form, setForm] = useState({ name: "", rating: 0, comment: "" });
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadReviews = async () => {
    try {
      setLoading(true);
      setListError("");
      const data = await getReviews();
      // Yeniden eskiye sırala
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      setReviews(sorted);
    } catch (err) {
      setListError(
        "Yorumlar şu an yüklenemiyor. Lütfen daha sonra tekrar deneyin."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!form.name.trim()) {
      setErrorMsg("Lütfen adınızı girin.");
      return;
    }
    if (!form.rating) {
      setErrorMsg("Lütfen bir puan verin (1-5 yıldız).");
      return;
    }
    if (!form.comment.trim()) {
      setErrorMsg("Lütfen yorumunuzu yazın.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createReview(form);
      // Optimistik: yeni yorumu listenin başına ekle
      if (created && created.id) {
        setReviews((prev) => [created, ...prev]);
      } else {
        loadReviews();
      }
      setForm({ name: "", rating: 0, comment: "" });
      setHover(0);
      setSuccessMsg("Yorumunuz için teşekkür ederiz! 🌿");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail ||
          "Yorumunuz gönderilemedi. Lütfen daha sonra tekrar deneyin."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rv-page">
      <div className="rv-bg" />
      <div className="rv-overlay" />

      <button
        type="button"
        className="rv-back"
        onClick={() => navigate("/")}
        aria-label="Ana sayfaya dön"
      >
        ← Ana Sayfa
      </button>

      <div className="rv-wrap">
        <div className="rv-head">
          <h1 className="rv-logo">SISLY RESORT</h1>
          <div className="rv-underline" />
          <p className="rv-tagline">Yorumlar</p>
          <p className="rv-sub">
            Deneyiminizi bizimle paylaşın — görüşleriniz bizim için çok değerli.
          </p>

          {stats.count > 0 && (
            <div className="rv-summary">
              <span className="rv-summary-avg">{stats.avg.toFixed(1)}</span>
              <Stars value={Math.round(stats.avg)} size={18} />
              <span className="rv-summary-count">{stats.count} değerlendirme</span>
            </div>
          )}
        </div>

        {/* Yorum formu */}
        <form className="rv-card" onSubmit={handleSubmit}>
          <div className="rv-field">
            <label htmlFor="name" className="rv-label">
              İsminiz
            </label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="rv-input"
              placeholder="Örn: Ayşe K."
              maxLength={60}
              autoComplete="name"
            />
          </div>

          <div className="rv-field">
            <label className="rv-label">Puanınız</label>
            <div
              className="rv-stars-input"
              onMouseLeave={() => setHover(0)}
              role="radiogroup"
              aria-label="Puan"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`rv-star-btn ${
                    (hover || form.rating) >= n ? "is-on" : ""
                  }`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setForm((p) => ({ ...p, rating: n }))}
                  aria-label={`${n} yıldız`}
                  aria-checked={form.rating === n}
                  role="radio"
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="rv-field">
            <label htmlFor="comment" className="rv-label">
              Yorumunuz
            </label>
            <textarea
              id="comment"
              name="comment"
              value={form.comment}
              onChange={handleChange}
              rows={4}
              className="rv-textarea"
              placeholder="Lezzetler, hizmet, atmosfer… deneyiminizi anlatın."
              maxLength={600}
            />
          </div>

          {errorMsg && <div className="rv-alert rv-alert-error">{errorMsg}</div>}
          {successMsg && (
            <div className="rv-alert rv-alert-success">{successMsg}</div>
          )}

          <button type="submit" disabled={submitting} className="rv-submit">
            {submitting ? (
              <>
                <span className="rv-spinner" /> Gönderiliyor...
              </>
            ) : (
              <>
                <span>Yorumu Gönder</span>
                <span className="rv-submit-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {/* Yorum listesi */}
        <div className="rv-list">
          {loading ? (
            <div className="rv-list-state">
              <span className="rv-spinner" /> Yorumlar yükleniyor…
            </div>
          ) : listError ? (
            <div className="rv-list-state">{listError}</div>
          ) : reviews.length === 0 ? (
            <div className="rv-list-state">
              Henüz yorum yok. İlk yorumu siz yazın! 🌿
            </div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rv-review">
                <div className="rv-review-top">
                  <span className="rv-review-name">{r.name || "Misafir"}</span>
                  <Stars value={Number(r.rating) || 0} />
                </div>
                <p className="rv-review-comment">{r.comment}</p>
                {r.created_at && (
                  <span className="rv-review-date">{fmtDate(r.created_at)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .rv-page {
          position: relative;
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 80px 20px 60px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #f5ecd1;
          overflow-x: hidden;
        }
        .rv-bg {
          position: fixed; inset: 0; z-index: 0;
          background: linear-gradient(135deg, #1a3a2e 0%, #0F2A1E 50%, #0a1f16 100%);
        }
        .rv-overlay {
          position: fixed; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse at top, rgba(214, 196, 142, 0.08), transparent 55%),
            radial-gradient(ellipse at bottom, rgba(214, 196, 142, 0.05), transparent 60%);
          pointer-events: none;
        }
        .rv-back {
          position: fixed;
          top: 22px; left: 22px;
          z-index: 5;
          padding: 9px 16px;
          background: rgba(10, 31, 22, 0.65);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(214, 196, 142, 0.25);
          border-radius: 10px;
          color: #d6c48e;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .rv-back:hover {
          background: rgba(214, 196, 142, 0.1);
          border-color: rgba(214, 196, 142, 0.5);
          color: #e6d49e;
        }
        .rv-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .rv-head {
          text-align: center;
          margin-bottom: 26px;
          animation: rvFadeDown 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .rv-logo {
          font-family: 'Playfair Display', serif;
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 400;
          color: #d6c48e;
          letter-spacing: 6px;
          margin: 0;
          text-shadow: 0 2px 20px rgba(214, 196, 142, 0.25);
        }
        .rv-underline {
          width: 100px;
          height: 1px;
          margin: 16px auto 14px;
          background: linear-gradient(90deg, transparent, #d6c48e, transparent);
        }
        .rv-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(16px, 2.2vw, 20px);
          color: rgba(214, 196, 142, 0.85);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin: 0 0 8px;
        }
        .rv-sub {
          font-size: 13px;
          color: rgba(245, 236, 209, 0.55);
          line-height: 1.55;
          margin: 0;
        }
        .rv-summary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 8px 16px;
          background: rgba(10, 31, 22, 0.6);
          border: 1px solid rgba(214, 196, 142, 0.22);
          border-radius: 999px;
        }
        .rv-summary-avg {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 600;
          color: #d6c48e;
          line-height: 1;
        }
        .rv-summary-count {
          font-size: 12px;
          color: rgba(245, 236, 209, 0.55);
        }

        .rv-card {
          width: 100%;
          padding: 28px 26px;
          background: rgba(10, 31, 22, 0.72);
          border: 1px solid rgba(214, 196, 142, 0.2);
          border-radius: 18px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          gap: 18px;
          animation: rvFadeUp 0.8s 0.15s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .rv-field { display: flex; flex-direction: column; }
        .rv-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: rgba(214, 196, 142, 0.7);
          margin-bottom: 8px;
        }
        .rv-input, .rv-textarea {
          width: 100%;
          padding: 11px 14px;
          font-family: inherit;
          font-size: 14px;
          color: #f5ecd1;
          background: rgba(10, 31, 22, 0.55);
          border: 1px solid rgba(214, 196, 142, 0.2);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rv-textarea { resize: vertical; min-height: 96px; line-height: 1.5; }
        .rv-input:focus, .rv-textarea:focus {
          border-color: rgba(214, 196, 142, 0.55);
          box-shadow: 0 0 0 3px rgba(214, 196, 142, 0.1);
        }
        .rv-input::placeholder, .rv-textarea::placeholder { color: rgba(245, 236, 209, 0.3); }

        .rv-stars-input { display: inline-flex; gap: 6px; }
        .rv-star-btn {
          background: none;
          border: none;
          padding: 0;
          font-size: 30px;
          line-height: 1;
          cursor: pointer;
          color: rgba(245, 236, 209, 0.22);
          transition: transform 0.15s ease, color 0.15s ease;
        }
        .rv-star-btn:hover { transform: scale(1.15); }
        .rv-star-btn.is-on { color: #e6c25a; text-shadow: 0 0 14px rgba(230, 194, 90, 0.45); }

        .rv-stars-static { white-space: nowrap; letter-spacing: 1px; }
        .rv-stars-static span { color: rgba(245, 236, 209, 0.2); }
        .rv-stars-static span.is-on { color: #e6c25a; }

        .rv-alert {
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13px;
          border: 1px solid;
          line-height: 1.5;
        }
        .rv-alert-error {
          background: rgba(239, 107, 107, 0.12);
          border-color: rgba(239, 107, 107, 0.35);
          color: #ffb3b3;
        }
        .rv-alert-success {
          background: rgba(110, 231, 183, 0.12);
          border-color: rgba(110, 231, 183, 0.35);
          color: #c6f4dc;
        }

        .rv-submit {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 2px;
          padding: 15px 24px;
          background: transparent;
          border: 1.5px solid #d6c48e;
          border-radius: 12px;
          color: #d6c48e;
          font-family: 'Playfair Display', serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rv-submit:hover:not(:disabled) {
          transform: scale(1.02);
          border-color: #e6d49e;
          color: #e6d49e;
          box-shadow: 0 0 30px rgba(214, 196, 142, 0.35), inset 0 0 20px rgba(214, 196, 142, 0.08);
        }
        .rv-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .rv-submit-arrow { transition: transform 0.3s ease; }
        .rv-submit:hover:not(:disabled) .rv-submit-arrow { transform: translateX(4px); }

        .rv-spinner {
          width: 14px; height: 14px;
          border-radius: 50%;
          border: 2px solid currentColor;
          border-top-color: transparent;
          animation: rvSpin 0.8s linear infinite;
          display: inline-block;
        }

        .rv-list {
          width: 100%;
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .rv-list-state {
          text-align: center;
          font-size: 13px;
          color: rgba(245, 236, 209, 0.5);
          padding: 24px 0;
        }
        .rv-review {
          padding: 18px 20px;
          background: rgba(10, 31, 22, 0.55);
          border: 1px solid rgba(214, 196, 142, 0.16);
          border-radius: 14px;
          animation: rvFadeUp 0.5s ease both;
        }
        .rv-review-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }
        .rv-review-name {
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          color: #e6d49e;
        }
        .rv-review-comment {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(245, 236, 209, 0.82);
          margin: 0 0 8px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .rv-review-date {
          font-size: 11px;
          letter-spacing: 0.5px;
          color: rgba(245, 236, 209, 0.4);
        }

        @keyframes rvFadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rvFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rvSpin { to { transform: rotate(360deg); } }

        @media (max-width: 520px) {
          .rv-page { padding: 70px 14px 40px; }
          .rv-back { top: 14px; left: 14px; padding: 7px 12px; font-size: 12px; }
          .rv-card { padding: 22px 18px; gap: 16px; }
          .rv-logo { letter-spacing: 4px; }
        }
      `}</style>
    </div>
  );
};

export default ReviewsPage;
