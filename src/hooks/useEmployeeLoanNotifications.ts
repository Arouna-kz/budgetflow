// hooks/useEmployeeLoanNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { EmployeeLoan } from '../types';

export const useEmployeeLoanNotifications = (loans: EmployeeLoan[]) => {
  const { userProfile } = useAuth();
  const [pendingSignatures, setPendingSignatures] = useState<EmployeeLoan[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const getUserProfession = useCallback((): string => {
    return userProfile?.profession || '';
  }, [userProfile]);

  const getPendingSignatures = useCallback((): EmployeeLoan[] => {
    const userProfession = getUserProfession();
    
    return loans.filter(loan => {
      if (userProfession === 'Coordinateur de la Subvention') {
        return !loan.approvals?.supervisor1?.signature;
      } else if (userProfession === 'Comptable') {
        return !loan.approvals?.supervisor2?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasSupervisor1Signed = loan.approvals?.supervisor1?.signature;
        const hasSupervisor2Signed = loan.approvals?.supervisor2?.signature;
        const hasFinalSigned = loan.approvals?.finalApproval?.signature;
        return hasSupervisor1Signed && hasSupervisor2Signed && !hasFinalSigned;
      }
      return false;
    });
  }, [loans, getUserProfession]);

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