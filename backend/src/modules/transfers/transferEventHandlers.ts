import { EventBus } from '../../core/eventBus';
import { ActivityService } from '../activity/activityService';
import { ComplianceService } from '../compliance/complianceService';
import { FraudService } from '../fraud/fraudService';
import { NotificationService } from '../notifications/notificationService';
import {
  TransferEventType,
  type TransferFailedEventPayload,
  type TransferFlaggedEventPayload,
  type TransferStateChangedEventPayload,
  type TransferSettledEventPayload,
} from './events';

export interface TransferEventHandlers {
  eventBus: EventBus;
  activity: ActivityService;
  compliance: ComplianceService;
  fraud: FraudService;
  notifications: NotificationService;
}

export function registerTransferEventHandlers(deps: TransferEventHandlers) {
  const subscriptions = [
    deps.eventBus.subscribe<TransferStateChangedEventPayload>(
      TransferEventType.StateChanged,
      async (event) => {
        await deps.activity.invalidateUser(event.payload.userId);
      },
    ),
    deps.eventBus.subscribe<TransferSettledEventPayload>(
      TransferEventType.Settled,
      async (event) => {
        await deps.compliance.recordSuccessfulTransfer(
          event.payload.userId,
          event.payload.amount,
        );
        await deps.notifications.notifyTransferSettled({
          userId: event.payload.userId,
          transferId: event.payload.transferId,
          amount: event.payload.amount,
          recipientName: event.payload.recipientName,
        });
      },
    ),
    deps.eventBus.subscribe<TransferFailedEventPayload>(
      TransferEventType.Failed,
      async (event) => {
        await deps.notifications.notifyTransferFailed({
          userId: event.payload.userId,
          transferId: event.payload.transferId,
          amount: event.payload.amount,
          recipientName: event.payload.recipientName,
          error: event.payload.error,
        });
      },
    ),
    deps.eventBus.subscribe<TransferFlaggedEventPayload>(
      TransferEventType.Flagged,
      async (event) => {
        await deps.activity.invalidateUser(event.payload.userId);
        deps.fraud.logAbnormalActivity({
          userId: event.payload.userId,
          transferId: event.payload.transferId,
          assessment: event.payload.assessment,
          recipientName: event.payload.recipientName,
        });
        await deps.notifications.notifyFraudFlagged({
          userId: event.payload.userId,
          transferId: event.payload.transferId,
          score: event.payload.assessment.score,
          flags: event.payload.assessment.flags.map((flag) => flag.label),
        });
      },
    ),
  ];

  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}
