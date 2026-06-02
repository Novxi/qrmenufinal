// src/lib/community.js
// Müşteri yorumları (reviews) ve müşteri favori önerileri için backend yardımcıları.
// Rezervasyonlarla aynı pattern: harici backend'e (REACT_APP_API_BASE) gider.
//
// Backend'e eklenmesi gereken uçlar README/NOT'ta listelendi:
//   GET    /api/reviews                 -> [ {id, name, rating, comment, created_at}, ... ]
//   POST   /api/reviews                 -> body {name, rating, comment}
//   DELETE /api/reviews/:id
//   GET    /api/favorite-suggestions    -> [ {id, scope, item_id, item_name, category_name, count, created_at}, ... ]
//   POST   /api/favorite-suggestions    -> body {scope, item_id, item_name, category_name}
//   DELETE /api/favorite-suggestions/:id
import { api } from "./api";

// ---------- Yorumlar ----------
export const getReviews = async () => {
  const res = await api.get("/reviews");
  return res.data || [];
};

export const createReview = async ({ name, rating, comment }) => {
  const res = await api.post("/reviews", {
    name: (name || "").trim(),
    rating: Number(rating) || 0,
    comment: (comment || "").trim(),
  });
  return res.data;
};

export const deleteReview = async (id) => {
  await api.delete(`/reviews/${id}`);
};

// ---------- Müşteri favori önerileri ----------
export const getFavoriteSuggestions = async () => {
  const res = await api.get("/favorite-suggestions");
  return res.data || [];
};

export const createFavoriteSuggestion = async ({
  scope = "restaurant",
  itemId,
  itemName,
  categoryName,
}) => {
  const res = await api.post("/favorite-suggestions", {
    scope,
    item_id: itemId,
    item_name: itemName,
    category_name: categoryName || null,
  });
  return res.data;
};

export const deleteFavoriteSuggestion = async (id) => {
  await api.delete(`/favorite-suggestions/${id}`);
};
