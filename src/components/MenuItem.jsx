import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Heart } from 'lucide-react';
import { Card } from './ui/card';
import { resolveImageUrl } from '../lib/api';
import { createFavoriteSuggestion } from '../lib/community';

const SUGGEST_KEY = 'sisly_fav_suggested';

const readSuggested = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SUGGEST_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const MenuItem = ({
  item,
  dietaryInfo,
  chefRecText,
  index,
  scope = 'restaurant',
  categoryName,
}) => {
  const suggestId = `${scope}:${item.id}`;
  const [suggested, setSuggested] = useState(() => readSuggested().has(suggestId));
  const [sending, setSending] = useState(false);

  const handleSuggest = async () => {
    if (suggested || sending) return;
    setSending(true);
    try {
      await createFavoriteSuggestion({
        scope,
        itemId: item.id,
        itemName: item.name,
        categoryName,
      });
      const set = readSuggested();
      set.add(suggestId);
      try {
        localStorage.setItem(SUGGEST_KEY, JSON.stringify([...set]));
      } catch {
        /* yoksay */
      }
      setSuggested(true);
    } catch {
      // Backend hazır değilse sessizce işaretleme — kullanıcıya hata gösterme
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Card className="menu-item-card">
        <motion.div
          className="menu-item-image-container"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={resolveImageUrl(item.image)}
            alt={item.name}
            className="menu-item-image"
            loading="lazy"
          />
          {item.chefRec && (
            <div className="chef-rec-badge" title={chefRecText}>
              <Star size={16} fill="currentColor" />
            </div>
          )}
          {item.favorite && (
            <div className="favorite-badge" title="Favori">
              <Heart size={14} fill="currentColor" />
              <span>Favori</span>
            </div>
          )}
        </motion.div>

        <div className="menu-item-content">
          <div className="menu-item-header">
            <h3 className="menu-item-name">{item.name}</h3>
            <span className="menu-item-price">₺{item.price}</span>
          </div>

          <p className="menu-item-description">{item.description}</p>

{item.badges && item.badges.length > 0 && (
  <div className="dietary-badges">
    {item.badges.map((badge) => (
      <span
        key={badge}
        className="dietary-badge"
        title={dietaryInfo && dietaryInfo[badge] ? dietaryInfo[badge] : ''}
      >
        {badge}
      </span>
    ))}
  </div>
)}

          <button
            type="button"
            className={`favorite-suggest-btn ${suggested ? 'is-suggested' : ''}`}
            onClick={handleSuggest}
            disabled={suggested || sending}
            title={suggested ? 'Favori olarak önerdiniz' : 'Bu lezzeti favori olarak öner'}
          >
            <Heart size={14} fill={suggested ? 'currentColor' : 'none'} />
            <span>{suggested ? 'Önerildi' : 'Favori öner'}</span>
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

export default MenuItem;
