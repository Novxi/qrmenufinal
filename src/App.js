// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import "./App.css";

// Eski restoran menüsü için kullandığın bileşenler
import Hero from "./components/Hero";
import MenuCategory from "./components/MenuCategory";
import MobileTabBar from "./components/MobileTabBar";
import DesktopNav from "./components/DesktopNav";
import SearchBar from "./components/SearchBar";
import LanguageToggle from "./components/LanguageToggle";
import BackToTop from "./components/BackToTop";
import Footer from "./components/Footer";
import { dietaryInfo, translations } from "./mock";
import { useMenuData } from "./hooks/useMenuData";

// Diğer sayfalar
import LandingPage from "./components/LandingPage";
import KirKahvesiMenu from "./components/KirKahvesiMenu";
import AdminMenuEditor from "./AdminMenuEditor";
import ReservationPage from "./components/ReservationPage";
import ReservationAdminPage from "./components/ReservationAdminPage";

/**
 * ORİJİNAL RESTORAN MENÜSÜ
 * (Eski App.js içeriğin)
 */
const RestaurantMenuPage = () => {
  const [lang, setLang] = useState("tr");
  const [tableNumber, setTableNumber] = useState(null);
  const [activeCategory, setActiveCategory] = useState("breakfast");
  const [searchOpen, setSearchOpen] = useState(false);

  const { menu: menuData, loading: menuLoading } = useMenuData("restaurant");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get("table");
    if (table) setTableNumber(table);
  }, []);

  const currentMenu = menuData?.[lang] || { categories: [] };
  const currentDietaryInfo = dietaryInfo[lang];
  const currentTranslations = translations[lang];

  // Restoran scope artık ayrı bir menü olduğu için kategori filtrelemesine gerek yok.
  // Kullanıcı admin'den istediği kategoriyi tutar / siler.
  const filteredCategories = currentMenu.categories || [];

  useEffect(() => {
    const handleScroll = () => {
      const categories = filteredCategories;
      const scrollPosition = window.scrollY + 150;

      for (let i = categories.length - 1; i >= 0; i--) {
        const section = document.getElementById(categories[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveCategory(categories[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lang]);

  const handleViewMenu = () => {
    const menuSection = document.getElementById("breakfast");
    if (!menuSection) return;

    const offset = 80;
    const elementPosition = menuSection.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === "en" ? "tr" : "en"));
  };

  if (menuLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a3a2e 0%, #0F2A1E 50%, #0a1f16 100%)",
        color: "#d6c48e",
        fontFamily: "'Playfair Display', serif",
        letterSpacing: 3,
      }}>
        Menü Yükleniyor…
      </div>
    );
  }

  return (
    <div className="menu-app">
      <Hero
        tableNumber={tableNumber}
        translations={currentTranslations}
        onViewMenu={handleViewMenu}
      />
      <div className="top-controls">
        <SearchBar
          categories={filteredCategories}
          onSearch={() => {}}
          isOpen={searchOpen}
          onToggle={() => setSearchOpen(!searchOpen)}
          lang={lang}
        />
        <LanguageToggle currentLang={lang} onToggle={toggleLanguage} />
      </div>
      <DesktopNav
        categories={filteredCategories}
        activeCategory={activeCategory}
        onCategoryClick={setActiveCategory}
      />
      <main className="menu-main">
        {filteredCategories.map((category) => (
          <MenuCategory
            key={category.id}
            category={category}
            dietaryInfo={currentDietaryInfo}
            chefRecText={currentTranslations.chefRec}
            lang={lang}
          />
        ))}
      </main>
      <MobileTabBar
        categories={filteredCategories}
        activeCategory={activeCategory}
        onCategoryClick={setActiveCategory}
      />
      <BackToTop translations={currentTranslations} />
      <Footer lang={lang} />
    </div>
  );
};

/**
 * ANA UYGULAMA – routing
 *
 * /                      -> LandingPage (karşılama ekranı)
 * /restaurant-menu       -> RestaurantMenuPage (eski restoran menüsü)
 * /kir-kahvesi-menu      -> KirKahvesiMenu
 * /rezervasyon           -> ReservationPage (müşteri rezervasyon formu)
 * /admin                 -> AdminMenuEditor (menü düzenleme)
 * /admin/reservations    -> ReservationAdminPage (rezervasyon listesi)
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* Karşılama ekranı */}
        <Route path="/" element={<LandingPage />} />

        {/* Restoran menüsü */}
        <Route path="/restaurant-menu" element={<RestaurantMenuPage />} />

        {/* Kır Kahvesi menüsü */}
        <Route path="/kir-kahvesi-menu" element={<KirKahvesiMenu />} />

        {/* Müşteri rezervasyon formu */}
        <Route path="/rezervasyon" element={<ReservationPage />} />

        {/* Admin: menü düzenleme */}
        <Route path="/admin" element={<AdminMenuEditor />} />

        {/* Admin: rezervasyon listesi */}
        <Route path="/admin/reservations" element={<ReservationAdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;
