import React, { createContext, useContext, useState, ReactNode } from 'react';

type AppMode = 'simple' | 'expert';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isExpert: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('ikoma_app_mode');
    return (saved as AppMode) || 'simple';
  });

  const handleSetMode = (newMode: AppMode) => {
    setMode(newMode);
    localStorage.setItem('ikoma_app_mode', newMode);
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode: handleSetMode, isExpert: mode === 'expert' }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
