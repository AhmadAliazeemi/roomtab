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

## Secure foundation implementation status

Implemented on the feature branch:
- Room administrators can enable or disable the setting. New rooms default to confirmation off; legacy rooms without the field are treated as off.
- The setting applies to new meals only. Existing meals retain their stored confirmation behavior when the setting changes.
- A confirmation-required meal stores a version number and a pointer to an immutable confirmation-round snapshot containing the current amount, date, and shares.
- Initial response records are created in the same Firestore batch as the meal. The recorder is auto-approved only for their own share when they selected themselves; all other selected members start as pending.
- Material edits to amount, date, or shares create a new confirmation round and preserve previous round records. Description-only edits retain the current round.
- Firestore rules restrict response creation/update to the selected member, prevent a meal creator from approving for another person, deny response deletion and round mutation, and require an atomic matching activity record for an approval/dispute.
- Emulator tests cover administrator-only setting changes, the required round on new confirmation-enabled meals, initial creator/pending states, forged approval denial, selected-member self-response with audit, non-selected response denial, and immutable rounds.

Not included in this secure-foundation change:
- The in-app notification inbox and participant approval/dispute screens.
- Push notification delivery.
- Scheduled 24-hour and 48-hour reminders. These need a server-side scheduler and deployment planning.
- The overpayment policy change, which remains a separate accounting task.

The foundation must pass the GitHub Firestore Emulator tests and production build before it is merged. No production Firebase rules deployment is part of this work.

- The response rules also verify that a participant is answering the expense's current confirmation round; late responses to superseded rounds are denied.
- Dispute reasons are stored on the participant response and the approval/dispute write requires a matching audit event in the same batch.
- Latest GitHub Actions run for the feature branch passed the accounting tests, dependency security regression test, 22 Firestore Emulator tests, and production build.
