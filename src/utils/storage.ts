// Utilitaires pour la persistance des données

const STORAGE_KEY = 'budget_management_data';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 heures

interface StorageData {
  data: any;
  timestamp: number;
}

export const saveToStorage = (data: any) => {
  try {
    const storageData: StorageData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
  } catch (error) {
    console.warn('Erreur lors de la sauvegarde:', error);
  }
};

export const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const storageData: StorageData = JSON.parse(stored);
    const now = Date.now();

    // Vérifier si les données ont expiré
    if (now - storageData.timestamp > STORAGE_EXPIRY) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return storageData.data;
  } catch (error) {
    console.warn('Erreur lors du chargement:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
};