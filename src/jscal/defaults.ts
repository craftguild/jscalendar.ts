import type { Alert, Event, JSCalendarObject, Participant, Task } from "../types.js";
import { STATUS_COMPLETED, STATUS_FAILED, STATUS_IN_PROCESS, STATUS_NEEDS_ACTION, TRIGGER_OFFSET } from "./constants.js";

/**
 * Apply common defaults to the target.
 * @param data JSCalendar object to mutate.
 * @return The same object with defaults applied.
 */
export function applyCommonDefaults<T extends JSCalendarObject>(data: T): T {
  if (data.sequence === undefined) data.sequence = 0;
  if (data.title === undefined) data.title = "";
  if (data.description === undefined) data.description = "";
  if (data.descriptionContentType === undefined) data.descriptionContentType = "text/plain";
  if (data.showWithoutTime === undefined) data.showWithoutTime = false;
  if (data.recurrenceIdTimeZone === undefined) data.recurrenceIdTimeZone = null;
  if (data.excluded === undefined) data.excluded = false;
  if (data.priority === undefined) data.priority = 0;
  if (data.freeBusyStatus === undefined) data.freeBusyStatus = "busy";
  if (data.privacy === undefined) data.privacy = "public";
  if (data.useDefaultAlerts === undefined) data.useDefaultAlerts = false;
  return data;
}

/**
 * Apply event defaults to the target.
 * @param data Event to mutate.
 * @return The same event with defaults applied.
 */
export function applyEventDefaults(data: Event): Event {
  if (data.duration === undefined) data.duration = "PT0S";
  if (data.status === undefined) data.status = "confirmed";
  return data;
}

/**
 * Apply task defaults to the target.
 * @param data Task to mutate.
 * @return The same task with defaults applied.
 */
export function applyTaskDefaults(data: Task): Task {
  if (data.progress === undefined) {
    const participants = data.participants ? Object.values(data.participants) : [];
    if (participants.length === 0) {
      data.progress = STATUS_NEEDS_ACTION;
    } else if (participants.every((p) => p.progress === STATUS_COMPLETED)) {
      data.progress = STATUS_COMPLETED;
    } else if (participants.some((p) => p.progress === STATUS_FAILED)) {
      data.progress = STATUS_FAILED;
    } else if (participants.some((p) => p.progress === STATUS_IN_PROCESS)) {
      data.progress = STATUS_IN_PROCESS;
    } else {
      data.progress = STATUS_NEEDS_ACTION;
    }
  }
  return data;
}

/**
 * Apply participant defaults to the target.
 * @param participant Participant to mutate.
 * @return The same participant with defaults applied.
 */
export function applyParticipantDefaults(participant: Participant): Participant {
  if (participant.participationStatus === undefined) participant.participationStatus = "needs-action";
  if (participant.expectReply === undefined) participant.expectReply = false;
  if (participant.scheduleAgent === undefined) participant.scheduleAgent = "server";
  if (participant.scheduleForceSend === undefined) participant.scheduleForceSend = false;
  if (participant.scheduleSequence === undefined) participant.scheduleSequence = 0;
  return participant;
}

/**
 * Apply alert defaults to the target.
 * @param alert Alert to mutate.
 * @return The same alert with defaults applied.
 */
export function applyAlertDefaults(alert: Alert): Alert {
  if (alert.action === undefined) alert.action = "display";
  if (alert.trigger["@type"] === TRIGGER_OFFSET) {
    if (alert.trigger.relativeTo === undefined) {
      alert.trigger.relativeTo = "start";
    }
  }
  return alert;
}
