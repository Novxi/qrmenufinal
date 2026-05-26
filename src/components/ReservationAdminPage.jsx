// src/components/ReservationAdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_BASE } from "../lib/api";
import AdminLayout from "./admin/AdminLayout";
import AdminLogin, { isAdminAuthed } from "./admin/AdminLogin";
import "./admin/admin.css";

// ---------- yardımcılar ----------
const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseResDate = (r) => {
  if (!r?.date) return null;
  const [y, m, d] = r.date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const fmtDateLong = (iso) => {
  const d = parseResDate({ date: iso });
  if (!d) return iso;
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
};

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

const formatPhoneDisplay = (raw) => {
  if (!raw) return "";
  // +905321234567 -> 0532 123 45 67
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (local.length === 12 && local.startsWith("90")) local = "0" + local.slice(2);
  else if (local.length === 10 && local.startsWith("5")) local = "0" + local;
  if (local.length !== 11) return raw;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}`;
};

const phoneForTel = (raw) => raw?.replace(/[^\d+]/g, "") || "";
const phoneForWhatsApp = (raw) => {
  // WhatsApp '+' istemiyor, sadece rakam
  return (raw || "").replace(/\D/g, "");
};

const FILTERS = [
  { key: "today", label: "Bugün" },
  { key: "upcoming", label: "Yaklaşan" },
  { key: "past", label: "Geçmiş" },
  { key: "all", label: "Tümü" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Hepsi" },
  { key: "pending", label: "Bekliyor" },
  { key: "confirmed", label: "Onaylı" },
  { key: "cancelled", label: "İptal" },
];

const ReservationAdminPage = () => {
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_BASE}/reservations`);
      setReservations(res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Rezervasyonlar alınırken bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) fetchReservations();
    else setLoading(false);
  }, [authed]);

  // ---------- türetilmiş ----------
  const today = useMemo(() => todayISO(), []);
  const weekEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d;
  }, [today]);

  const enriched = useMemo(() => {
    return reservations.map((r) => {
      const d = parseResDate(r);
      let bucket = "past";
      if (d) {
        const t = d.getTime();
        if (t === today.getTime()) bucket = "today";
        else if (t > today.getTime()) bucket = "upcoming";
      }
      return { ...r, _date: d, _bucket: bucket };
    });
  }, [reservations, today]);

  const stats = useMemo(() => {
    const todayCount = enriched.filter((r) => r._bucket === "today").length;
    const weekCount = enriched.filter(
      (r) => r._date && r._date >= today && r._date <= weekEnd
    ).length;
    const upcomingCount = enriched.filter(
      (r) => r._bucket === "upcoming" || r._bucket === "today"
    ).length;
    const pendingCount = enriched.filter(
      (r) => (r.status || "pending") === "pending" && (r._bucket === "today" || r._bucket === "upcoming")
    ).length;
    return {
      total: enriched.length,
      today: todayCount,
      week: weekCount,
      upcoming: upcomingCount,
      pending: pendingCount,
    };
  }, [enriched, today, weekEnd]);

  const visible = useMemo(() => {
    let list = enriched;
    if (filter !== "all") list = list.filter((r) => r._bucket === filter);
    if (statusFilter !== "all") {
      list = list.filter((r) => (r.status || "pending") === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.note || "").toLowerCase().includes(q) ||
          (r.type || "").toLowerCase().includes(q) ||
          (r.phone || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const ad = a._date ? a._date.getTime() : 0;
      const bd = b._date ? b._date.getTime() : 0;
      if (ad !== bd) return ad - bd;
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
  }, [enriched, filter, statusFilter, search]);

  const navCounts = useMemo(
    () => ({ "/admin/reservations": stats.pending }),
    [stats.pending]
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Bu rezervasyonu silmek istediğine emin misin?")) return;
    try {
      await axios.delete(`${API_BASE}/reservations/${id}`);
      setReservations((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Silinirken bir hata oluştu.");
    }
  };

  const handleStatus = async (id, status) => {
    try {
      const res = await axios.patch(`${API_BASE}/reservations/${id}`, { status });
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...res.data } : r))
      );
    } catch {
      alert("Durum güncellenirken hata oluştu.");
    }
  };

  const handleExportCSV = () => {
    window.open(`${API_BASE}/reservations/export`, "_blank");
  };

  // ---------- render ----------
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  if (loading) {
    return (
      <div className="admin-loader">
        <span className="admin-spinner" />
        <span style={{ marginLeft: 12 }}>Rezervasyonlar Yükleniyor</span>
      </div>
    );
  }

  const headerActions = (
    <>
      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={handleExportCSV}
      >
        ↓ CSV İndir
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-primary"
        onClick={fetchReservations}
        disabled={loading}
      >
        {loading ? <><span className="admin-spinner" /> Yenileniyor</> : "Yenile"}
      </button>
    </>
  );

  return (
    <AdminLayout
      title="Rezervasyonlar"
      subtitle="Kim, kaç kişi, hangi gün, saatte ve hangi telefonla geliyor — buradan takip et."
      actions={headerActions}
      navCounts={navCounts}
    >
      {error && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="res-stats">
        <StatCard label="Bekleyen" value={stats.pending} highlight />
        <StatCard label="Bugün" value={stats.today} />
        <StatCard label="Bu Hafta" value={stats.week} />
        <StatCard label="Toplam" value={stats.total} />
      </div>

      <div className="res-toolbar">
        <div className="admin-segment">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "is-active" : ""}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="admin-segment">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={statusFilter === f.key ? "is-active" : ""}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="admin-search" style={{ flex: 1, minWidth: 220 }}>
          <span className="admin-search-icon">⌕</span>
          <input
            className="admin-input"
            placeholder="İsim, telefon, tür veya not ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📭</div>
          <div className="admin-empty-title">
            {search
              ? "Eşleşen rezervasyon yok"
              : filter === "today"
              ? "Bugün için rezervasyon yok"
              : "Bu filtrede rezervasyon yok"}
          </div>
        </div>
      ) : (
        <div className="res-list">
          {visible.map((r) => (
            <ReservationCard
              key={r.id}
              res={r}
              onDelete={() => handleDelete(r.id)}
              onStatus={(s) => handleStatus(r.id, s)}
            />
          ))}
        </div>
      )}

      <style>{`
        .res-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        }
        .res-stat {
          padding: 18px 20px;
          background: var(--admin-surface);
          border: 1px solid var(--admin-gold-faint);
          border-radius: 14px;
        }
        .res-stat.is-highlight {
          background: linear-gradient(135deg, rgba(214, 196, 142, 0.16), rgba(214, 196, 142, 0.04));
          border-color: rgba(214, 196, 142, 0.35);
        }
        .res-stat-label {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--admin-text-dim);
          margin-bottom: 8px;
        }
        .res-stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 30px;
          font-weight: 600;
          color: var(--admin-gold);
          line-height: 1;
        }
        .res-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 18px;
        }
        .res-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .res-card {
          display: grid;
          grid-template-columns: 100px 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 16px 18px;
          background: var(--admin-surface-3);
          border: 1px solid var(--admin-gold-faint);
          border-radius: 14px;
          transition: border-color 0.2s ease;
        }
        .res-card:hover { border-color: var(--admin-gold-muted); }
        .res-card.is-today {
          background: linear-gradient(135deg, rgba(214, 196, 142, 0.12), rgba(214, 196, 142, 0.02));
          border-color: rgba(214, 196, 142, 0.35);
        }
        .res-card.is-past { opacity: 0.62; }
        .res-card.is-cancelled { opacity: 0.5; }
        .res-date-block {
          text-align: center;
          padding: 6px 10px;
          border-right: 1px solid var(--admin-gold-faint);
        }
        .res-date-day {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 600;
          color: var(--admin-gold);
          line-height: 1;
        }
        .res-date-mo {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--admin-text-muted);
          margin-top: 4px;
        }
        .res-date-time {
          font-size: 13px;
          color: var(--admin-gold-bright);
          font-weight: 600;
          margin-top: 6px;
          font-variant-numeric: tabular-nums;
        }
        .res-info-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 6px;
        }
        .res-info-name {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          color: var(--admin-text);
          font-weight: 500;
        }
        .res-info-meta {
          font-size: 12px;
          color: var(--admin-text-muted);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .res-info-meta .dot::before { content: "•"; margin-right: 12px; color: var(--admin-text-dim); }
        .res-info-note {
          font-size: 12px;
          color: var(--admin-text-muted);
          margin-top: 8px;
          padding: 8px 10px;
          border-left: 2px solid var(--admin-gold-faint);
          background: rgba(214, 196, 142, 0.04);
          border-radius: 0 8px 8px 0;
        }
        .res-info-created {
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--admin-text-dim);
          margin-top: 8px;
        }
        .res-type-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(214, 196, 142, 0.1);
          border: 1px solid var(--admin-gold-faint);
          color: var(--admin-gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: capitalize;
        }
        .res-people-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          color: var(--admin-text);
        }
        .res-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: stretch;
        }
        .res-action-row {
          display: flex;
          gap: 6px;
        }

        @media (max-width: 880px) {
          .res-stats { grid-template-columns: repeat(2, 1fr); }
          .res-card { grid-template-columns: 80px 1fr; }
          .res-card > .res-actions {
            grid-column: 1 / -1;
            flex-direction: row;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </AdminLayout>
  );
};

const StatCard = ({ label, value, highlight }) => (
  <div className={`res-stat ${highlight ? "is-highlight" : ""}`}>
    <div className="res-stat-label">{label}</div>
    <div className="res-stat-value">{value}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cls =
    status === "confirmed"
      ? "res-status-confirmed"
      : status === "cancelled"
      ? "res-status-cancelled"
      : "res-status-pending";
  const label =
    status === "confirmed" ? "Onaylı" : status === "cancelled" ? "İptal" : "Bekliyor";
  return <span className={`res-status-pill ${cls}`}>{label}</span>;
};

const ReservationCard = ({ res, onDelete, onStatus }) => {
  const d = res._date;
  const dayNum = d ? d.getDate() : "—";
  const moStr = d
    ? d.toLocaleDateString("tr-TR", { month: "short" }).replace(".", "")
    : "";
  const status = res.status || "pending";
  const cardClass = `res-card ${res._bucket === "today" ? "is-today" : ""} ${
    res._bucket === "past" ? "is-past" : ""
  } ${status === "cancelled" ? "is-cancelled" : ""}`;

  const phoneDisplay = formatPhoneDisplay(res.phone);
  const wa = phoneForWhatsApp(res.phone);

  return (
    <div className={cardClass}>
      <div className="res-date-block">
        <div className="res-date-day">{dayNum}</div>
        <div className="res-date-mo">{moStr}</div>
        <div className="res-date-time">{res.time || "--:--"}</div>
      </div>

      <div>
        <div className="res-info-head">
          <span className="res-info-name">{res.name || "—"}</span>
          <StatusBadge status={status} />
        </div>
        <div className="res-info-meta">
          <span className="res-people-pill">👥 {res.people} kişi</span>
          <span className="dot">
            <span className="res-type-pill">{res.type || "yemek"}</span>
          </span>
          {res.phone ? (
            <span className="dot">
              <a
                href={`tel:${phoneForTel(res.phone)}`}
                className="res-phone-link"
                title="Aramak için tıkla"
              >
                📞 {phoneDisplay}
              </a>
              {wa && (
                <>
                  {" "}
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="res-phone-link"
                    title="WhatsApp'tan yaz"
                    style={{ marginLeft: 6 }}
                  >
                    💬 WhatsApp
                  </a>
                </>
              )}
            </span>
          ) : (
            <span className="dot" style={{ color: "var(--admin-text-dim)" }}>
              telefon yok
            </span>
          )}
          {d && <span className="dot">{fmtDateLong(res.date)}</span>}
        </div>
        {res.note && <div className="res-info-note">"{res.note}"</div>}
        {res.created_at && (
          <div className="res-info-created">
            Alındı: {fmtCreated(res.created_at)}
          </div>
        )}
      </div>

      <div className="res-actions">
        {status !== "confirmed" && (
          <button
            type="button"
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => onStatus("confirmed")}
            title="Onayla"
          >
            ✓ Onayla
          </button>
        )}
        {status !== "cancelled" && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onStatus("cancelled")}
            title="İptal et"
          >
            İptal
          </button>
        )}
        {status !== "pending" && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => onStatus("pending")}
            title="Bekliyor yap"
          >
            ↺ Bekliyor
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-danger admin-btn-sm"
          onClick={onDelete}
        >
          Sil
        </button>
      </div>
    </div>
  );
};

export default ReservationAdminPage;
