import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  currentUser: null,
  theme: 'industrial', // 'industrial', 'light', 'aurora', 'executive'
  layout: 'kiosk',     // 'kiosk', 'sidebar', 'bento', 'topnav'

  // Ova funkcija se poziva kada se radnik (npr. Edin) prijavi u sistem
  initSettings: (username) => {
    if (!username) return;
    
    // Tražimo postavke u memoriji ovog specifičnog uređaja za ovog radnika
    const saved = localStorage.getItem(`ERP_SETTINGS_${username}`);
    
    if (saved) {
      const parsed = JSON.parse(saved);
      set({ 
        currentUser: username, 
        theme: parsed.theme || 'industrial', 
        layout: parsed.layout || 'kiosk' 
      });
      // Odmah oblačimo HTML tag u odabranu temu
      document.documentElement.setAttribute('data-theme', parsed.theme || 'industrial');
    } else {
      // Ako se prijavio prvi put na ovom uređaju, dajemo mu standardni dizajn
      set({ currentUser: username, theme: 'industrial', layout: 'kiosk' });
      document.documentElement.setAttribute('data-theme', 'industrial');
    }
  },

  // Funkcija za promjenu teme (klikom na dugme)
  setTheme: (newTheme) => {
    set({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Odmah spašavamo novu temu u uređaj, samo za trenutnog radnika
    const { currentUser, layout } = get();
    if (currentUser) {
      localStorage.setItem(`ERP_SETTINGS_${currentUser}`, JSON.stringify({ theme: newTheme, layout }));
    }
  },

  // Funkcija za promjenu rasporeda (školjke)
  setLayout: (newLayout) => {
    set({ layout: newLayout });
    
    // Spašavamo novi raspored u uređaj
    const { currentUser, theme } = get();
    if (currentUser) {
      localStorage.setItem(`ERP_SETTINGS_${currentUser}`, JSON.stringify({ theme, layout: newLayout }));
    }
  }
}));