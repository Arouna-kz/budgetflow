// hooks/useEngagementNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Engagement } from '../types';

export const useEngagementNotifications = (engagements: Engagement[]) => {
  const { userProfile } = useAuth();
  const [pendingSignatures, setPendingSignatures] = useState<Engagement[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Récupère la profession de l'utilisateur
  const getUserProfession = useCallback((): string => {
    return userProfile?.profession || '';
  }, [userProfile]);

  // Récupère les engagements en attente de signature pour l'utilisateur actuel
  const getPendingSignatures = useCallback((): Engagement[] => {
    const userProfession = getUserProfession();
    
    return engagements.filter(engagement => {
      if (userProfession === 'Coordinateur de la Subvention') {
        return !engagement.approvals?.supervisor1?.signature;
      } else if (userProfession === 'Comptable') {
        return !engagement.approvals?.supervisor2?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasSupervisor1Signed = engagement.approvals?.supervisor1?.signature;
        const hasSupervisor2Signed = engagement.approvals?.supervisor2?.signature;
        const hasFinalSigned = engagement.approvals?.finalApproval?.signature;
        return hasSupervisor1Signed && hasSupervisor2Signed && !hasFinalSigned;
      }
      return false;
    });
  }, [engagements, getUserProfession]);

  // Met à jour les notifications
  useEffect(() => {
    const pending = getPendingSignatures();
    setPendingSignatures(pending);
    setNotificationCount(pending.length);
  }, [getPendingSignatures]);

  return {
    pendingSignatures,
    notificationCount,
    hasNotifications: notificationCount > 0
  };
};