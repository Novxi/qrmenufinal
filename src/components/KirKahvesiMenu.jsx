// src/components/KirKahvesiMenu.jsx
import React from "react";
import MenuCategory from "./MenuCategory";
import { useMenuData } from "../hooks/useMenuData";
import { withFavoritesCategory } from "../lib/favorites";

const KirKahvesiMenu = () => {
  // Artık kendi ayrı scope'undan okuyor — restoran menüsünden bağımsız.
  const { menu, loading } = useMenuData("kir_kahvesi");

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: "#d6c48e", textAlign: "center" }}>
        Menü Yükleniyor…
      </div>
    );
  }

  const lang = menu?.tr ? "tr" : "en";
  const localized = menu?.tr || menu?.en || { categories: [] };
  const baseCategories = Array.isArray(localized.categories)
    ? localized.categories
    : [];
  const categories = withFavoritesCategory(baseCategories, lang);

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        Kır Kahvesi Menüsü
      </h1>

      {categories.map((cat) => (
        <MenuCategory key={cat.id ?? cat.name} category={cat} scope="kir_kahvesi" />
      ))}
    </div>
  );
};

export default KirKahvesiMenu;
