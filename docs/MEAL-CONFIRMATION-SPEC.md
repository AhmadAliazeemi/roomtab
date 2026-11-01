# Meal confirmation — product and implementation specification

Status: approved for implementation planning
Target branch: `feature/meal-confirmation`

## Purpose

Make shared-meal records trustworthy by letting every selected participant confirm that they ate the meal and agree with their individual share. A roommate who was not selected can see that a meal was entered but cannot approve or dispute it.

## Room setting

- Add an administrator-controlled room setting: **Require meal confirmation**.
- Default: off, preserving existing room behavior.
- The setting applies to new meal entries only.
- Turning the setting off does not silently approve, cancel, or rewrite requests that are already pending.
- Personal/individual meals should follow the same rule if the creator selects another participant; normally an individual meal has only its creator as a participant.

## Submission and notifications

- When enabled, submitting a meal creates a confirmation request.
- Notify every active roommate in the room, including people who were not selected.
- Only the creator and selected active participants can respond. The creator's act of submitting the meal counts as their own confirmation only if they selected themselves.
- Each selected participant must respond individually. No majority approval and no automatic approval.
- Do not imply that a notification means the recipient is a participant or owes a share.

## Participant response

Each selected participant can:
- **Approve**: confirm both participation and the displayed personal share.
- **Dispute**: state that they did not participate or that the amount/share is wrong. A dispute reason should be collected.

A non-selected roommate may view the notification/meal details but sees no approval or dispute controls.

## Meal-level status

- **Pending**: at least one selected participant has not responded and nobody has disputed.
- **Disputed / needs review**: at least one selected participant has disputed.
- **Confirmed**: every selected participant has approved the current version of the meal.

No unanswered request is ever treated as approved.

## Accounting treatment

- The room's actual canteen expense is recorded when the meal is submitted, because the cost has already been incurred.
- Individual shares that are not approved must be visibly marked as pending and must not be presented as confirmed personal debt.
- The UI must clearly separate room canteen debt from each roommate's confirmed, pending, and disputed personal share.
- Reimbursement transfers remain separate from canteen payments and do not reduce the room's canteen debt.

## Changes, disputes, and corrections

- Changes to total amount, participant list, or any participant's share are material. They invalidate responses for the previous version and require a fresh confirmation round from the affected selected participants (implementation should prefer a new version/round so the old responses remain auditable).
- Changes only to non-financial descriptive text, such as a spelling correction, do not require new approval.
- Keep disputes and prior responses in the activity/audit history.
- An administrator may remind participants and may correct or cancel an entry according to authorization rules, but cannot approve on another person's behalf.
- A cancelled entry must remain auditable and must not continue contributing to active accounting totals.

## Reminder policy

- No automatic approval, ever.
- First reminder is due 24 hours after the request is created.
- Second reminder is due 48 hours after the request is created if the request is still unresolved.
- After the second reminder, the request stays pending or disputed until a participant responds or an authorized correction/cancellation occurs.
- Reminders must be idempotent: each reminder stage is sent no more than once per request version.
- The reminder mechanism must run server-side if reminders are expected while the app is closed. A browser timer or a check that only runs when a user opens the app is not sufficient.

## Delivery phases

1. Build the secure core: setting, versioned participant responses, authorization rules, audit history, and emulator tests.
2. Build the in-app notification inbox and approval/dispute experience. Notify all active room members; expose response controls only to selected participants.
3. Add server-side 24-hour and 48-hour reminders. Confirm the Firebase project's supported deployment/billing configuration before choosing the scheduler.
4. Add browser/Android push delivery as a separate enhancement, with user permission and graceful in-app fallback.

## Required security and test cases

- A room member cannot approve or dispute a meal unless they are selected for its current version.
- A selected participant can only submit their own response.
- A non-member cannot read or respond to room confirmations.
- A creator cannot manufacture another participant's approval.
- Meal confirmation state cannot be changed by an unrelated room member.
- A meal is confirmed only when every selected participant approved its current version.
- Any material edit invalidates the previous version's approvals without deleting audit history.
- A dispute prevents the meal from being shown as confirmed.
- Missing responses remain pending after 24 and 48 hours; reminders never approve.
- Notifications go to every active room member, while only selected participants can respond.
- Existing rooms with the setting off and existing meals keep their current behavior.

## Related agreed accounting change

Remove the automatic room overpayment-credit behavior from the user experience. The intended policy is to allow partial payments and payments up to the outstanding canteen debt, while rejecting a payment that would exceed the current outstanding debt. Preserve payer-versus-recorder attribution and correct individual roommate balances. This accounting change is a separate implementation task and must have dedicated tests, including concurrent/stale-balance considerations.
