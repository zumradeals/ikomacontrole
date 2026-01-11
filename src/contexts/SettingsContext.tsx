import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface Settings {
  runner_base_url: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSetting: (key: keyof Settings, value: string) => void;
  isLoading: boolean;
}

const defaultSettings: Settings = {
  runner_base_url: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load settings from localStorage initially
    const saved = localStorage.getItem('ikoma_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    setIsLoading(false);
  }, []);

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('ikoma_settings', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
