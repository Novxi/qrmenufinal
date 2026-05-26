// src/AdminMenuEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api, API_BASE } from "./lib/api";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLogin, { isAdminAuthed } from "./components/admin/AdminLogin";
import ImageUploader from "./components/admin/ImageUploader";
import "./components/admin/admin.css";

// ---------- yardımcılar ----------
const generateItemId = (categoryId, items) => {
  const prefix = (categoryId || "x")[0];
  const nums = items
    .map((it) => {
      const m = String(it.id || "").match(/[a-zA-Z]+(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n) => n !== null);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${next}`;
};

const generateCategoryId = (categories) => {
  const used = new Set(categories.map((c) => c.id));
  let i = 1;
  let id = `cat${i}`;
  while (used.has(id)) {
    i += 1;
    id = `cat${i}`;
  }
  return id;
};

const emptyItem = (id) => ({
  id,
  name: "",
  description: "",
  price: 0,
  image: "",
  badges: [],
  chefRec: false,
});

const emptyCategory = (id) => ({
  id,
  name: "Yeni Kategori",
  subtitle: "",
  image: "",
  motif: "",
  items: [],
});

// ---------- ana component ----------
const SCOPES = [
  { key: "restaurant", label: "Restoran" },
  { key: "kir_kahvesi", label: "Kır Kahvesi" },
];

const SCOPE_STORAGE_KEY = "sisly_admin_menu_scope";

const AdminMenuEditor = () => {
  const [authed, setAuthed] = useState(isAdminAuthed());
  const [scope, setScope] = useState(() => {
    if (typeof window === "undefined") return "restaurant";
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
    return saved && SCOPES.some((s) => s.key === saved) ? saved : "restaurant";
  });
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [selectedLang, setSelectedLang] = useState("tr");
  const [selectedCatIdx, setSelectedCatIdx] = useState(0);
  const [search, setSearch] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  const switchScope = (next) => {
    if (next === scope) return;
    if (
      dirty &&
      !window.confirm(
        "Kaydedilmemiş değişiklikler var. Diğer menüye geçersen kaybolacak. Devam edilsin mi?"
      )
    ) {
      return;
    }
    localStorage.setItem(SCOPE_STORAGE_KEY, next);
    setScope(next);
    setSelectedCatIdx(0);
    setSearch("");
  };

  // Backend henüz scope-aware değilse (eski versiyon), kır kahvesi tab'i
  // legacy /api/menu'ye düşemez — gerçek bir veri yok orada.
  const [legacyMode, setLegacyMode] = useState(false);

  // ---------- veri çek (scope değişince yeniden çekilir) ----------
  useEffect(() => {
    if (!authed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchMenu = async () => {
      try {
        setLoading(true);
        setError("");

        // Önce yeni scope-aware endpoint'i dene
        let data;
        try {
          const res = await api.get(`/menu/${scope}`);
          data = res.data;
          setLegacyMode(false);
        } catch (err) {
          // Backend eski versiyon olabilir; legacy /api/menu'ye düş
          if (err.response?.status === 404) {
            // Sadece restaurant scope için legacy fallback mantıklı.
            if (scope !== "restaurant") {
              throw new Error(
                "Bu backend henüz Kır Kahvesi'ni desteklemiyor. Yeni server.py'yi VDS'e deploy etmen gerekiyor."
              );
            }
            const legacy = await api.get(`/menu`);
            data = legacy.data;
            setLegacyMode(true);
          } else {
            throw err;
          }
        }

        if (cancelled) return;
        setMenu(data);
        setDirty(false);
        setSelectedCatIdx(0);
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Menü verisi alınırken bir hata oluştu."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMenu();
    return () => {
      cancelled = true;
    };
  }, [authed, scope]);

  // Sayfadan ayrılırken kayıtsız değişiklik uyarısı
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---------- türetilmiş veriler ----------
  const langKeys = useMemo(() => (menu ? Object.keys(menu) : []), [menu]);
  const currentLang =
    menu && selectedLang in menu ? selectedLang : langKeys[0];
  const currentCategories = useMemo(
    () => (menu && currentLang ? menu[currentLang]?.categories || [] : []),
    [menu, currentLang]
  );
  const activeCategory =
    currentCategories[selectedCatIdx] || currentCategories[0] || null;

  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeCategory.items.map((it, idx) => ({ it, idx }));
    return activeCategory.items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => {
        return (
          (it.name || "").toLowerCase().includes(q) ||
          (it.description || "").toLowerCase().includes(q) ||
          String(it.id || "").toLowerCase().includes(q)
        );
      });
  }, [activeCategory, search]);

  const navCounts = useMemo(() => {
    return {
      "/admin": currentCategories.reduce(
        (acc, c) => acc + (c.items?.length || 0),
        0
      ),
    };
  }, [currentCategories]);

  // ---------- mutasyonlar ----------
  const mutateMenu = (mutator) => {
    setMenu((prev) => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      mutator(copy);
      return copy;
    });
    setDirty(true);
  };

  const handleItemChange = (catIndex, itemIndex, field, value) => {
    mutateMenu((copy) => {
      const item = copy[currentLang].categories[catIndex].items[itemIndex];
      if (field === "price") item[field] = Number(value) || 0;
      else if (field === "badges") {
        item[field] = value
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);
      } else if (field === "chefRec") item[field] = !!value;
      else item[field] = value;
    });
  };

  const handleCategoryChange = (catIndex, field, value) => {
    mutateMenu((copy) => {
      copy[currentLang].categories[catIndex][field] = value;
    });
  };

  const addNewItem = (catIndex) => {
    mutateMenu((copy) => {
      const category = copy[currentLang].categories[catIndex];
      const newId = generateItemId(category.id, category.items);
      category.items.push(emptyItem(newId));
    });
    setSearch("");
  };

  const deleteItem = (catIndex, itemIndex) => {
    if (!window.confirm("Bu ürünü silmek istediğine emin misin?")) return;
    mutateMenu((copy) => {
      copy[currentLang].categories[catIndex].items.splice(itemIndex, 1);
    });
  };

  const addNewCategory = () => {
    mutateMenu((copy) => {
      const list = copy[currentLang].categories;
      list.push(emptyCategory(generateCategoryId(list)));
    });
    setSelectedCatIdx(currentCategories.length); // yeni eklenene odakla
  };

  const deleteCategory = (catIndex) => {
    const cat = currentCategories[catIndex];
    if (!cat) return;
    if (
      !window.confirm(
        `"${cat.name}" kategorisini ve içindeki tüm ürünleri silmek istediğine emin misin?`
      )
    )
      return;
    mutateMenu((copy) => {
      copy[currentLang].categories.splice(catIndex, 1);
    });
    setSelectedCatIdx((idx) => Math.max(0, idx - (catIndex <= idx ? 1 : 0)));
  };

  const reorderItems = (catIndex, fromIdx, toIdx) => {
    mutateMenu((copy) => {
      const list = copy[currentLang].categories[catIndex].items;
      copy[currentLang].categories[catIndex].items = arrayMove(
        list,
        fromIdx,
        toIdx
      );
    });
  };

  const reorderCategories = (fromIdx, toIdx) => {
    mutateMenu((copy) => {
      copy[currentLang].categories = arrayMove(
        copy[currentLang].categories,
        fromIdx,
        toIdx
      );
    });
    // Aktif kategori indeksini güncelle
    setSelectedCatIdx((prev) => {
      if (prev === fromIdx) return toIdx;
      if (fromIdx < prev && toIdx >= prev) return prev - 1;
      if (fromIdx > prev && toIdx <= prev) return prev + 1;
      return prev;
    });
  };

  const saveChanges = async () => {
    if (!menu) return;
    try {
      setSaving(true);
      setError("");
      // Legacy backend ise /api/menu'yu kullan; yeni backend ise /api/menu/{scope}
      const path = legacyMode ? "/menu" : `/menu/${scope}`;
      await api.put(path, menu);
      setSavedFlash(true);
      setDirty(false);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Kaydederken bir hata oluştu."
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------- export / import (her zaman aktif scope üzerinde) ----------
  const handleExport = () => {
    const path = legacyMode ? `/menu/export` : `/menu/${scope}/export`;
    window.open(`${API_BASE}${path}`, "_blank");
  };

  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const importPath = legacyMode ? `/menu/import` : `/menu/${scope}/import`;
      const getPath = legacyMode ? `/menu` : `/menu/${scope}`;
      const res = await api.post(importPath, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fresh = await api.get(getPath);
      setMenu(fresh.data);
      setDirty(false);
      setShowImportModal(false);
      alert(
        `Import başarılı (${scope}). Kategori sayıları: ${JSON.stringify(
          res.data?.categories || {}
        )}`
      );
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          err.message ||
          "Import sırasında hata oluştu."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------- render ----------
  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  if (loading) {
    return (
      <div className="admin-loader">
        <span className="admin-spinner" />
        <span style={{ marginLeft: 12 }}>Menü Yükleniyor</span>
      </div>
    );
  }

  if (error && !menu) {
    return (
      <AdminLayout title="Menü Yönetimi">
        <div className="admin-alert admin-alert-error">{error}</div>
      </AdminLayout>
    );
  }

  if (!menu) {
    return (
      <AdminLayout title="Menü Yönetimi">
        <div className="admin-empty">
          <div className="admin-empty-icon">🍽</div>
          <div className="admin-empty-title">Menü bulunamadı</div>
        </div>
      </AdminLayout>
    );
  }

  const headerActions = (
    <>
      <div className="admin-segment menu-scope-segment" role="tablist" aria-label="Menü">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => switchScope(s.key)}
            className={scope === s.key ? "is-active" : ""}
            title={s.key === "restaurant" ? "Restoran menüsü" : "Kır Kahvesi menüsü"}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="admin-segment" role="tablist" aria-label="Dil">
        {langKeys.map((l) => (
          <button
            key={l}
            onClick={() => setSelectedLang(l)}
            className={currentLang === l ? "is-active" : ""}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={handleExport}
        title={`Seçili menüyü (${scope === "restaurant" ? "Restoran" : "Kır Kahvesi"}) JSON olarak indir`}
      >
        ↓ JSON İndir
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={handleImportClick}
        title="Eski JSON'u yükle"
      >
        ↑ JSON Yükle
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-primary"
        onClick={saveChanges}
        disabled={saving || !dirty}
      >
        {saving ? (
          <>
            <span className="admin-spinner" /> Kaydediliyor
          </>
        ) : savedFlash ? (
          <>✓ Kaydedildi</>
        ) : dirty ? (
          <>Değişiklikleri Kaydet</>
        ) : (
          <>Kaydedildi</>
        )}
      </button>
    </>
  );

  return (
    <AdminLayout
      title={`Menü Yönetimi · ${scope === "restaurant" ? "Restoran" : "Kır Kahvesi"}`}
      subtitle="Üst sağdaki Restoran / Kır Kahvesi seçimiyle iki ayrı menüyü bağımsız düzenleyebilirsin. Kategorileri ve ürünleri sürükle bırak ile sırala, görselleri bilgisayardan yükle."
      actions={headerActions}
      navCounts={navCounts}
    >
      {error && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}
      {legacyMode && !error && (
        <div className="admin-alert" style={{
          marginBottom: 18,
          background: "rgba(214, 196, 142, 0.10)",
          border: "1px solid rgba(214, 196, 142, 0.35)",
          color: "#e6d49e",
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 13,
        }}>
          <b>Eski backend</b> moduna düşüldü — Kır Kahvesi ayrı menüsü desteklenmiyor. Yeni <code>server.py</code>'yi VDS'e deploy edersen iki menü ayrı çalışır.
        </div>
      )}
      {dirty && !error && (
        <div className="admin-alert" style={{
          marginBottom: 18,
          background: "rgba(214, 196, 142, 0.10)",
          border: "1px solid rgba(214, 196, 142, 0.35)",
          color: "#e6d49e",
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 13,
        }}>
          Kaydedilmemiş değişiklikler var. Üst sağdaki <b>Değişiklikleri Kaydet</b> butonuna bas.
        </div>
      )}

      <div className="menu-editor-grid">
        {/* Kategori sütunu */}
        <div className="menu-editor-cats">
          <div className="admin-sidebar-label" style={{ padding: "0 4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Kategoriler</span>
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={addNewCategory}
              title="Yeni kategori ekle"
              style={{ padding: "4px 8px", fontSize: 11 }}
            >
              + Yeni
            </button>
          </div>

          <CategorySortableList
            categories={currentCategories}
            selectedIdx={selectedCatIdx}
            onSelect={(idx) => {
              setSelectedCatIdx(idx);
              setSearch("");
            }}
            onReorder={reorderCategories}
          />
        </div>

        {/* Seçili kategori — header + ürünler */}
        <div className="menu-editor-main">
          {activeCategory ? (
            <>
              {/* Kategori header editörü */}
              <div className="cat-header-editor">
                <ImageUploader
                  value={activeCategory.image}
                  onChange={(url) =>
                    handleCategoryChange(selectedCatIdx, "image", url)
                  }
                  kind="category"
                  aspect="wide"
                  placeholder="Kategori başlık görseli"
                />
                <div className="cat-header-meta">
                  <div>
                    <label className="admin-field-label">Kategori Adı</label>
                    <input
                      className="admin-input"
                      value={activeCategory.name || ""}
                      onChange={(e) =>
                        handleCategoryChange(selectedCatIdx, "name", e.target.value)
                      }
                      placeholder="Örn: Kahvaltı"
                    />
                  </div>
                  <div>
                    <label className="admin-field-label">Alt Başlık</label>
                    <input
                      className="admin-input"
                      value={activeCategory.subtitle || ""}
                      onChange={(e) =>
                        handleCategoryChange(
                          selectedCatIdx,
                          "subtitle",
                          e.target.value
                        )
                      }
                      placeholder="Kategoriye özel kısa açıklama"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="menu-item-id">
                      ID: <b>{activeCategory.id}</b>
                    </span>
                    <span className="menu-item-id">
                      {activeCategory.items.length} ürün
                    </span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => deleteCategory(selectedCatIdx)}
                      style={{ marginLeft: "auto" }}
                    >
                      Kategoriyi Sil
                    </button>
                  </div>
                </div>
              </div>

              <div className="menu-cat-head">
                <div>
                  <div className="menu-cat-head-title">
                    {activeCategory.name}
                    <span className="menu-cat-head-id">#{activeCategory.id}</span>
                  </div>
                  {activeCategory.subtitle && (
                    <div className="menu-cat-head-sub">
                      {activeCategory.subtitle}
                    </div>
                  )}
                </div>
                <button
                  className="admin-btn admin-btn-ghost"
                  onClick={() => addNewItem(selectedCatIdx)}
                >
                  + Yeni Ürün
                </button>
              </div>

              <div className="admin-search" style={{ marginBottom: 18 }}>
                <span className="admin-search-icon">⌕</span>
                <input
                  className="admin-input"
                  placeholder={`${activeCategory.name} içinde ara…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="admin-empty">
                  <div className="admin-empty-icon">🍃</div>
                  <div className="admin-empty-title">
                    {search ? "Eşleşen ürün yok" : "Bu kategoride ürün yok"}
                  </div>
                  {!search && (
                    <button
                      className="admin-btn admin-btn-primary"
                      style={{ marginTop: 14 }}
                      onClick={() => addNewItem(selectedCatIdx)}
                    >
                      + İlk Ürünü Ekle
                    </button>
                  )}
                </div>
              ) : (
                <ItemSortableList
                  // Aramada gösterilen liste sırasıyla aynı (search varken sürükleme devre dışı)
                  searchActive={!!search.trim()}
                  items={activeCategory.items}
                  onReorder={(from, to) => reorderItems(selectedCatIdx, from, to)}
                  filteredItems={filteredItems}
                  onChange={(itemIdx, field, value) =>
                    handleItemChange(selectedCatIdx, itemIdx, field, value)
                  }
                  onDelete={(itemIdx) => deleteItem(selectedCatIdx, itemIdx)}
                />
              )}
            </>
          ) : (
            <div className="admin-empty">
              <div className="admin-empty-icon">🍽</div>
              <div className="admin-empty-title">Kategori seçili değil</div>
              <button
                className="admin-btn admin-btn-primary"
                style={{ marginTop: 14 }}
                onClick={addNewCategory}
              >
                + İlk Kategoriyi Ekle
              </button>
            </div>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onFile={handleImportFile}
          fileInputRef={fileInputRef}
          scopeLabel={scope === "restaurant" ? "Restoran" : "Kır Kahvesi"}
        />
      )}

      <style>{`
        .menu-editor-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 22px;
        }
        .menu-editor-cats {
          position: sticky;
          top: 90px;
          align-self: start;
          max-height: calc(100vh - 110px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .menu-cat-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .menu-cat-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          color: var(--admin-text-muted);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .menu-cat-btn:hover { background: var(--admin-gold-ghost); color: var(--admin-gold-bright); }
        .menu-cat-btn.is-active {
          background: linear-gradient(135deg, rgba(214, 196, 142, 0.16), rgba(214, 196, 142, 0.04));
          border-color: var(--admin-gold-faint);
          color: var(--admin-gold);
        }
        .menu-cat-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .menu-cat-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 14px;
          margin-bottom: 18px;
          border-bottom: 1px solid var(--admin-gold-faint);
          flex-wrap: wrap;
        }
        .menu-cat-head-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          color: var(--admin-gold);
          letter-spacing: 1px;
        }
        .menu-cat-head-id {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: var(--admin-text-dim);
          margin-left: 10px;
          letter-spacing: 1px;
        }
        .menu-cat-head-sub {
          font-size: 12px;
          color: var(--admin-text-muted);
          margin-top: 4px;
        }
        .menu-item-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .menu-item-thumb-wrap { width: 120px; }
        .menu-item-body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .menu-item-row {
          display: grid;
          grid-template-columns: 1fr 130px;
          gap: 10px;
        }
        .menu-item-id {
          font-family: 'Inter', monospace;
          font-size: 10px;
          color: var(--admin-text-dim);
          letter-spacing: 1px;
        }
        .menu-item-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding-top: 6px;
          border-top: 1px dashed var(--admin-gold-faint);
          flex-wrap: wrap;
        }
        .menu-item-chef {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--admin-text-muted);
          cursor: pointer;
          user-select: none;
        }
        .menu-item-chef input { accent-color: var(--admin-gold); }

        @media (max-width: 880px) {
          .menu-editor-grid { grid-template-columns: 1fr; }
          .menu-editor-cats { position: static; max-height: none; }
          .menu-cat-list { flex-direction: row; overflow-x: auto; padding-bottom: 8px; }
          .menu-cat-btn { white-space: nowrap; }
          .menu-item-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  );
};

// ---------- Kategori sortable list ----------
const CategorySortableList = ({ categories, selectedIdx, onSelect, onReorder }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = categories.map((c, i) => `cat-${c.id}-${i}`);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="menu-cat-list">
          {categories.map((cat, idx) => (
            <SortableCategoryItem
              key={ids[idx]}
              sortId={ids[idx]}
              cat={cat}
              isActive={selectedIdx === idx}
              onSelect={() => onSelect(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

const SortableCategoryItem = ({ sortId, cat, isActive, onSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`menu-cat-btn ${isActive ? "is-active" : ""}`} onClick={onSelect} role="button" tabIndex={0}>
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title="Sürükle"
      >
        ⋮⋮
      </span>
      <span className="menu-cat-name">{cat.name || "Adsız"}</span>
      <span className="admin-nav-count">{cat.items?.length || 0}</span>
    </div>
  );
};

// ---------- Item sortable list ----------
const ItemSortableList = ({
  items,
  filteredItems,
  searchActive,
  onReorder,
  onChange,
  onDelete,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Gerçek listenin ID'leri (sıralama için)
  const ids = items.map((it, i) => `item-${it.id || "x"}-${i}`);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  // Filtrede arama varsa, drag-drop'u kapatıyoruz (yanlış sıralama olmasın)
  if (searchActive) {
    return (
      <div className="menu-item-list">
        {filteredItems.map(({ it, idx }) => (
          <ItemCardV2
            key={ids[idx]}
            item={it}
            onChange={(field, value) => onChange(idx, field, value)}
            onDelete={() => onDelete(idx)}
            draggable={false}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="menu-item-list">
          {items.map((it, idx) => (
            <SortableItemCard
              key={ids[idx]}
              sortId={ids[idx]}
              item={it}
              onChange={(field, value) => onChange(idx, field, value)}
              onDelete={() => onDelete(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

const SortableItemCard = ({ sortId, item, onChange, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ItemCardV2
        item={item}
        onChange={onChange}
        onDelete={onDelete}
        draggable
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
};

// ---------- Ürün kartı ----------
const ItemCardV2 = ({
  item,
  onChange,
  onDelete,
  draggable = false,
  dragAttributes,
  dragListeners,
}) => {
  return (
    <div className="menu-item-card-v2">
      {draggable ? (
        <span
          className="drag-handle"
          {...dragAttributes}
          {...dragListeners}
          title="Sürükle"
          style={{ alignSelf: "start", marginTop: 4 }}
        >
          ⋮⋮
        </span>
      ) : (
        <span className="drag-handle" style={{ visibility: "hidden" }}>⋮⋮</span>
      )}

      <div className="menu-item-thumb-wrap">
        <ImageUploader
          value={item.image}
          onChange={(url) => onChange("image", url)}
          kind="menu"
          aspect="square"
          placeholder="Ürün görseli"
        />
      </div>

      <div className="menu-item-body">
        <div className="menu-item-row">
          <div>
            <label className="admin-field-label">Ürün Adı</label>
            <input
              className="admin-input"
              value={item.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Ürün adı"
            />
          </div>
          <div>
            <label className="admin-field-label">Fiyat (₺)</label>
            <input
              type="number"
              className="admin-input"
              value={item.price ?? ""}
              onChange={(e) => onChange("price", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="admin-field-label">Açıklama</label>
          <textarea
            className="admin-textarea"
            value={item.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Kısa açıklama"
          />
        </div>

        <div>
          <label className="admin-field-label">Rozetler (virgülle ayır)</label>
          <input
            className="admin-input"
            value={(item.badges || []).join(", ")}
            onChange={(e) => onChange("badges", e.target.value)}
            placeholder="örn: V, VE, GF"
          />
        </div>

        <div className="menu-item-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="menu-item-id">ID: {item.id}</span>
            <label className="menu-item-chef">
              <input
                type="checkbox"
                checked={!!item.chefRec}
                onChange={(e) => onChange("chefRec", e.target.checked)}
              />
              Şefin Önerisi
            </label>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-danger admin-btn-sm"
            onClick={onDelete}
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Import modal ----------
const ImportModal = ({ onClose, onFile, fileInputRef, scopeLabel = "" }) => {
  const [drag, setDrag] = useState(false);

  const pickFile = () => fileInputRef.current?.click();

  return (
    <div
      className="admin-modal-bg"
      onClick={(e) => {
        if (e.target.classList.contains("admin-modal-bg")) onClose();
      }}
    >
      <div className="admin-modal">
        <h3 className="admin-modal-title">
          {scopeLabel ? `${scopeLabel} Menüsünü Yükle` : "Menü Verisini Yükle"}
        </h3>
        <div className="admin-modal-body">
          {scopeLabel && (
            <div style={{
              marginBottom: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(214, 196, 142, 0.10)",
              border: "1px solid rgba(214, 196, 142, 0.35)",
              color: "#e6d49e",
              fontSize: 12,
              letterSpacing: 0.5,
            }}>
              Yüklenecek menü: <b>{scopeLabel}</b> · Diğer menü etkilenmez.
            </div>
          )}
          Eski backend'inden indirdiğin <b>menü JSON</b> dosyasını seç. Mevcut menünün
          otomatik yedeği alınır. Format: <code>{`{ "tr": { "categories": [...] }, "en": {...} }`}</code>
        </div>

        <div
          onClick={pickFile}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          style={{
            border: `1.5px dashed ${drag ? "var(--admin-gold)" : "var(--admin-gold-faint)"}`,
            borderRadius: 12,
            padding: "28px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: drag ? "rgba(214, 196, 142, 0.08)" : "rgba(10, 31, 22, 0.55)",
            marginBottom: 16,
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: 28, color: "var(--admin-gold)" }}>↑</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--admin-text-muted)" }}>
            JSON dosyasını sürükle bırak veya seç
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminMenuEditor;
