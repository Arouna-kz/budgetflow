// contexts/GlobalNotificationContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GlobalNotificationContextType {
  // Notifications par module
  engagementNotifications: number;
  paymentNotifications: number;
  prefinancingNotifications: number;
  employeeLoanNotifications: number;
  
  // Totaux
  totalNotifications: number;
  hasAnyNotifications: boolean;
  
  // Fonctions de mise à jour
  updateEngagementNotifications: (count: number) => void;
  updatePaymentNotifications: (count: number) => void;
  updatePrefinancingNotifications: (count: number) => void;
  updateEmployeeLoanNotifications: (count: number) => void;
  
  // Fonction pour réinitialiser toutes les notifications
  resetAllNotifications: () => void;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

// ✅ Export du Provider (c'est ce composant que vous devez utiliser)
export const GlobalNotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [engagementNotifications, setEngagementNotifications] = useState(0);
  const [paymentNotifications, setPaymentNotifications] = useState(0);
  const [prefinancingNotifications, setPrefinancingNotifications] = useState(0);
  const [employeeLoanNotifications, setEmployeeLoanNotifications] = useState(0);

  const totalNotifications = engagementNotifications + paymentNotifications + prefinancingNotifications + employeeLoanNotifications;
  const hasAnyNotifications = totalNotifications > 0;

  const updateEngagementNotifications = (count: number) => {
    setEngagementNotifications(count);
  };

  const updatePaymentNotifications = (count: number) => {
    setPaymentNotifications(count);
  };

  const updatePrefinancingNotifications = (count: number) => {
    setPrefinancingNotifications(count);
  };

  const updateEmployeeLoanNotifications = (count: number) => {
    setEmployeeLoanNotifications(count);
  };

  const resetAllNotifications = () => {
    setEngagementNotifications(0);
    setPaymentNotifications(0);
    setPrefinancingNotifications(0);
    setEmployeeLoanNotifications(0);
  };

  return (
    <GlobalNotificationContext.Provider value={{ 
      engagementNotifications,
      paymentNotifications,
      prefinancingNotifications,
      employeeLoanNotifications,
      totalNotifications,
      hasAnyNotifications,
      updateEngagementNotifications,
      updatePaymentNotifications,
      updatePrefinancingNotifications,
      updateEmployeeLoanNotifications,
      resetAllNotifications
    }}>
      {children}
    </GlobalNotificationContext.Provider>
  );
};

// ✅ Export du hook (pour utiliser le contexte dans les composants)
export const useGlobalNotifications = () => {
  const context = useContext(GlobalNotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider');
  }
  return context;
};

// ❌ NE PAS exporter le contexte directement - il est utilisé en interne
// export { GlobalNotificationContext };