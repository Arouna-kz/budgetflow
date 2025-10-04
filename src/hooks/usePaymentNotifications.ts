// hooks/usePaymentNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Payment } from '../types';

export const usePaymentNotifications = (payments: Payment[]) => {
  const { userProfile } = useAuth();
  const [pendingSignatures, setPendingSignatures] = useState<Payment[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const getUserProfession = useCallback((): string => {
    return userProfile?.profession || '';
  }, [userProfile]);

  const getPendingSignatures = useCallback((): Payment[] => {
    const userProfession = getUserProfession();
    
    return payments.filter(payment => {
      if (userProfession === 'Coordinateur de la subvention') {
        return !payment.approvals?.financialController?.signature;
      } else if (userProfession === 'Comptable') {
        return !payment.approvals?.accountingManager?.signature;
      } else if (userProfession === 'Coordonnateur National') {
        const hasFinancialControllerSigned = payment.approvals?.financialController?.signature;
        const hasAccountingManagerSigned = payment.approvals?.accountingManager?.signature;
        const hasNationalCoordinatorSigned = payment.approvals?.nationalCoordinator?.signature;
        return hasFinancialControllerSigned && hasAccountingManagerSigned && !hasNationalCoordinatorSigned;
      }
      return false;
    });
  }, [payments, getUserProfession]);

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