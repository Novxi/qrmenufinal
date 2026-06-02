// src/lib/favorites.js
// Admin'in ürün düzeyinde işaretlediği (item.favorite === true) ürünleri toplayıp
// menünün en başına sanal bir "Favoriler" kategorisi olarak ekler.
// Gerçek bir kategori değildir; sadece görüntüleme için türetilir.

export const FAVORITES_CATEGORY_ID = "favoriler";

export function withFavoritesCategory(categories, lang = "tr") {
  const list = Array.isArray(categories) ? categories : [];

  const favItems = [];
  for (const cat of list) {
    if (cat?.id === FAVORITES_CATEGORY_ID) continue; // çift eklemeyi önle
    for (const it of cat?.items || []) {
      if (it?.favorite) favItems.push(it);
    }
  }

  if (favItems.length === 0) return list;

  const favCategory = {
    id: FAVORITES_CATEGORY_ID,
    name: lang === "en" ? "Favorites" : "Favoriler",
    subtitle:
      lang === "en"
        ? "Our guests' most loved dishes"
        : "En çok sevilen lezzetlerimiz",
    motif: "dawn",
    image: favItems.find((it) => it.image)?.image || "",
    items: favItems,
    isFavorites: true,
  };

  return [favCategory, ...list];
}
