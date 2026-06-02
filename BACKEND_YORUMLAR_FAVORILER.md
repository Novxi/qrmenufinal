# Backend'e Eklenmesi Gereken Uçlar — Yorumlar & Favori Önerileri

Frontend tarafı hazır. Aşağıdaki uçlar backend'de (`server.py` — rezervasyonlarla
aynı dosya) tanımlı olmalı. Uçlar tanımlanana kadar:

- `/yorumlar` sayfasında form çalışır ama "gönderilemedi" hatası verir,
- Admin'de **Yorumlar & Favoriler** sayfası boş görünür,
- Menüdeki **"Favori öner"** butonu sessizce işe yaramaz (kullanıcıya hata göstermez).

> Not: Menüde ürünü **"Favoriler" grubunda göstermek** için backend değişikliği
> GEREKMEZ. Admin → Menü Yönetimi'nde ürünü **⭐ Favori** olarak işaretleyip
> kaydetmen yeterli; menü zaten kaydedilen ürün alanlarını (`favorite`) saklıyor.
> Aşağıdaki uçlar yalnızca **müşteri yorumları** ve **müşteri favori önerileri** içindir.

## Gereken uçlar

### Yorumlar
| Method | Yol | Açıklama |
|--------|-----|----------|
| `GET`  | `/api/reviews` | Tüm yorumlar (yeni→eski). Hem genel sayfa hem admin kullanır. |
| `POST` | `/api/reviews` | Body: `{ "name": str, "rating": 1-5, "comment": str }` |
| `DELETE` | `/api/reviews/{id}` | Yorumu sil (admin). |

### Favori önerileri
| Method | Yol | Açıklama |
|--------|-----|----------|
| `GET`  | `/api/favorite-suggestions` | Tüm öneriler. |
| `POST` | `/api/favorite-suggestions` | Body: `{ "scope": str, "item_id": str, "item_name": str, "category_name": str\|null }` |
| `DELETE` | `/api/favorite-suggestions/{id}` | Öneriyi sil. |

> `POST /favorite-suggestions` aynı `(scope, item_id)` için tekrar gelirse yeni kayıt
> açmak yerine `count` alanını artırması önerilir (aşağıdaki örnek bunu yapar).

## Örnek FastAPI implementasyonu (server.py'ye ekle)

JSON dosyasında saklayan basit bir örnek (rezervasyon mantığına benzer).
Mevcut DB'n neyse ona uyarlayabilirsin.

```python
import json, os, uuid
from datetime import datetime
from fastapi import HTTPException
from pydantic import BaseModel, Field

REVIEWS_FILE = "reviews.json"
FAV_FILE = "favorite_suggestions.json"

def _load(path):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------- Yorumlar ----------
class ReviewIn(BaseModel):
    name: str
    rating: int = Field(ge=1, le=5)
    comment: str

@app.get("/api/reviews")
def list_reviews():
    return sorted(_load(REVIEWS_FILE),
                  key=lambda r: r.get("created_at", ""), reverse=True)

@app.post("/api/reviews")
def create_review(body: ReviewIn):
    name = body.name.strip()
    comment = body.comment.strip()
    if not name or not comment:
        raise HTTPException(400, "İsim ve yorum zorunludur.")
    review = {
        "id": str(uuid.uuid4()),
        "name": name[:60],
        "rating": body.rating,
        "comment": comment[:600],
        "created_at": datetime.utcnow().isoformat(),
    }
    data = _load(REVIEWS_FILE)
    data.append(review)
    _save(REVIEWS_FILE, data)
    return review

@app.delete("/api/reviews/{review_id}")
def delete_review(review_id: str):
    data = _load(REVIEWS_FILE)
    new = [r for r in data if r.get("id") != review_id]
    if len(new) == len(data):
        raise HTTPException(404, "Yorum bulunamadı.")
    _save(REVIEWS_FILE, new)
    return {"ok": True}

# ---------- Favori önerileri ----------
class FavIn(BaseModel):
    scope: str = "restaurant"
    item_id: str
    item_name: str
    category_name: str | None = None

@app.get("/api/favorite-suggestions")
def list_favorite_suggestions():
    return _load(FAV_FILE)

@app.post("/api/favorite-suggestions")
def create_favorite_suggestion(body: FavIn):
    data = _load(FAV_FILE)
    # Aynı ürün tekrar önerilirse count artır
    for s in data:
        if s.get("scope") == body.scope and s.get("item_id") == body.item_id:
            s["count"] = int(s.get("count", 1)) + 1
            s["updated_at"] = datetime.utcnow().isoformat()
            _save(FAV_FILE, data)
            return s
    suggestion = {
        "id": str(uuid.uuid4()),
        "scope": body.scope,
        "item_id": body.item_id,
        "item_name": body.item_name,
        "category_name": body.category_name,
        "count": 1,
        "created_at": datetime.utcnow().isoformat(),
    }
    data.append(suggestion)
    _save(FAV_FILE, data)
    return suggestion

@app.delete("/api/favorite-suggestions/{sug_id}")
def delete_favorite_suggestion(sug_id: str):
    data = _load(FAV_FILE)
    new = [s for s in data if s.get("id") != sug_id]
    if len(new) == len(data):
        raise HTTPException(404, "Öneri bulunamadı.")
    _save(FAV_FILE, new)
    return {"ok": True}
```
