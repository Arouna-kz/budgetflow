import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NotificationContextType {
  engagementNotifications: number;
  updateEngagementNotifications: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [engagementNotifications, setEngagementNotifications] = useState(0);

  const updateEngagementNotifications = (count: number) => {
    setEngagementNotifications(count);
  };

  return (
    <NotificationContext.Provider value={{ 
      engagementNotifications, 
      updateEngagementNotifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};