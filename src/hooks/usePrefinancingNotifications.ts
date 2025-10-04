// hooks/usePrefinancingNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Prefinancing } from '../types';

export const usePrefinancingNotifications = (prefinancings: Prefinancing[]) => {
  const { userProfile } = useAuth();
  const [pendingSignatures, setPendingSignatures] = useState<Prefinancing[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const getUserProfession = useCallback((): string => {
    return userProfile?.profession || '';
  }, [userProfile]);

  const getPendingSignatures = useCallback((): Prefinancing[] => {
    const userProfession = getUserProfession();
    
    return prefinancings.filter(prefinancing => {
      if (userProfession === 'Coordinateur de la Subvention') {
        return !prefinancing.approvals?.supervisor1?.signature;
      } else if (userProfession === 'Comptable') {
        return !prefinancing.approvals?.supervisor2?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasSupervisor1Signed = prefinancing.approvals?.supervisor1?.signature;
        const hasSupervisor2Signed = prefinancing.approvals?.supervisor2?.signature;
        const hasFinalSigned = prefinancing.approvals?.finalApproval?.signature;
        return hasSupervisor1Signed && hasSupervisor2Signed && !hasFinalSigned;
      }
      return false;
    });
  }, [prefinancings, getUserProfession]);

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