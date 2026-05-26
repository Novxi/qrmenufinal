import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

const LanguageToggle = ({ currentLang, onToggle }) => {
  return (
    <motion.button
      type="button"
      className="language-toggle"
      onClick={onToggle}
      aria-label={currentLang === 'en' ? 'Türkçe' : 'English'}
      title={currentLang === 'en' ? 'Türkçe\'ye geç' : 'Switch to English'}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Globe size={18} />
      <span className="language-label">{currentLang === 'en' ? 'TR' : 'EN'}</span>
    </motion.button>
  );
};

export default LanguageToggle;