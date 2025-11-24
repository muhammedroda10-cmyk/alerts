import { useState, useEffect } from "react";

export interface AppSettings {
  apiUrl: string;
  apiToken: string;
  geminiKey: string;
  geminiModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: "https://accounts.fly4all.com/api/booking/flight",
  apiToken: "",
  geminiKey: "",
  geminiModel: "gemini-1.5-flash-latest",
};

const STORAGE_KEYS = {
  TOKEN: "booking_api_token",
  GEMINI_KEY: "gemini_api_key",
  GEMINI_MODEL: "gemini_model",
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || "";
    const geminiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || "";
    const geminiModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULT_SETTINGS.geminiModel;

    setSettings((prev) => ({
      ...prev,
      apiToken: token,
      geminiKey,
      geminiModel,
    }));
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };

      // Persist to localStorage
      if (newSettings.apiToken !== undefined) localStorage.setItem(STORAGE_KEYS.TOKEN, updated.apiToken);
      if (newSettings.geminiKey !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, updated.geminiKey);
      if (newSettings.geminiModel !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, updated.geminiModel);

      return updated;
    });
  };

  return {
    settings,
    updateSettings,
    isLoaded
  };
}
