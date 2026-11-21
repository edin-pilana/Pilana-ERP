import { create } from 'zustand';

const VALID_THEMES = ['industrial', 'aurora', 'light', 'executive'];
const VALID_LAYOUTS = ['sidebar', 'topnav', 'bento', 'kiosk'];

const applyThemeToDom = (theme) => {
  if (typeof document === 'undefined') return;
  const safeTheme = VALID_THEMES.includes(theme) ? theme : 'industrial';
  document.documentElement.setAttribute('data-theme', safeTheme);
};

export const useAppStore = create((set, get) => ({
  currentUser: null,
  theme: 'industrial', // 'industrial', 'light', 'aurora', 'executive'
  layout: 'sidebar',   // 'sidebar', 'topnav', 'bento', 'kiosk'

  initSettings: (username) => {
    if (!username || typeof window === 'undefined') return;

    let resolvedTheme = 'industrial';
    let resolvedLayout = 'sidebar';

    try {
      const savedUser = localStorage.getItem(`ERP_SETTINGS_${username}`);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (VALID_THEMES.includes(parsed?.theme)) resolvedTheme = parsed.theme;
        if (VALID_LAYOUTS.includes(parsed?.layout)) resolvedLayout = parsed.layout;
      } else {
        const devTheme = localStorage.getItem('erp_device_theme');
        const devLayout = localStorage.getItem('erp_device_layout');
        if (VALID_THEMES.includes(devTheme)) resolvedTheme = devTheme;
        if (VALID_LAYOUTS.includes(devLayout)) resolvedLayout = devLayout;
      }
    } catch (e) {
      resolvedTheme = 'industrial';
      resolvedLayout = 'sidebar';
    }

    set({
      currentUser: username,
      theme: resolvedTheme,
      layout: resolvedLayout
    });
    applyThemeToDom(resolvedTheme);
    try {
      localStorage.setItem('erp_device_theme', resolvedTheme);
      localStorage.setItem('erp_device_layout', resolvedLayout);
    } catch (e) {}
  },

  setTheme: (newTheme) => {
    const safeTheme = VALID_THEMES.includes(newTheme) ? newTheme : 'industrial';
    set({ theme: safeTheme });
    applyThemeToDom(safeTheme);

    if (typeof window === 'undefined') return;
    const { currentUser, layout } = get();
    try {
      localStorage.setItem('erp_device_theme', safeTheme);
      if (currentUser) {
        localStorage.setItem(`ERP_SETTINGS_${currentUser}`, JSON.stringify({ theme: safeTheme, layout }));
      }
    } catch (e) {}
  },

  setLayout: (newLayout) => {
    const safeLayout = VALID_LAYOUTS.includes(newLayout) ? newLayout : 'sidebar';
    set({ layout: safeLayout });

    if (typeof window === 'undefined') return;
    const { currentUser, theme } = get();
    try {
      localStorage.setItem('erp_device_layout', safeLayout);
      if (currentUser) {
        localStorage.setItem(`ERP_SETTINGS_${currentUser}`, JSON.stringify({ theme, layout: safeLayout }));
      }
    } catch (e) {}
  }
}));
