# UI/UX Design Specification

## Offline Field Issue Tracker

## 1. Experience Principles

1. **Local truth is visible:** “Saved on this device” is never confused with “Synced to server”.
2. **One primary action:** the field form emphasizes Save Draft or Submit, not navigation.
3. **Recoverable by default:** every failure states what happened and what the user can do.
4. **Readable in difficult conditions:** high contrast, large type, strong borders, and no color-only meaning.
5. **Progressive detail:** workers see essential fields first; coordinators see dense operational detail.

## 2. Responsive Surfaces

| Surface | Target | Layout |
|---|---|---|
| Field capture | 360–768 px mobile | Single column, sticky bottom action bar |
| Queue manager | Mobile/tablet | Cards with status and Retry |
| Coordinator dashboard | ≥1024 px desktop | Filter rail, table/list, detail drawer |

## 3. Connectivity Status Banner

The banner is persistent at the top of the app and includes text plus iconography:

| State | Copy | Behavior |
|---|---|---|
| Online | `Online` | Normal background; sync worker may run |
| Offline | `Offline — saved reports will sync later` | Amber/gray; disable no local actions |
| Syncing | `Syncing 2 of 5` | Progress indicator; do not hide queue |
| Sync Error | `Sync error — Review queue` | Red/amber; links to failed item details |

The banner must not claim online reachability solely from `navigator.onLine`; a failed request can move the app to `Sync Error`.

## 4. Component Hierarchy and States

```text
AppShell
├── ConnectivityBanner
├── RouteView
│   ├── FieldReportForm
│   │   ├── CategorySelect
│   │   ├── DescriptionInput
│   │   ├── PrioritySegmentedControl
│   │   ├── LocationCapture
│   │   └── FormActionBar
│   ├── QueueManager
│   │   ├── QueueSummary
│   │   └── QueueItemCard
│   └── CoordinatorDashboard
│       ├── FilterBar
│       ├── ReportTable
│       ├── ReportDetailPanel
│       └── TransitionModal
└── ToastRegion / ErrorSummary
```

Status badges always pair a label with an icon and pattern:

| Status | Meaning | Example text |
|---|---|---|
| Draft | Not submitted | `Draft` |
| Pending Sync | Durable locally, awaiting server | `Pending sync` |
| Synced | Server acknowledged | `Synced` |
| Failed | Action required | `Failed — Fix and retry` |

## 5. Wireframe Flows

### 5.1 Field Worker Report Form

```text
┌──────────────────────────────────┐
│ [≡] New issue          [Offline] │
├──────────────────────────────────┤
│ Category *                       │
│ [ Select infrastructure type  v ]│
│                                  │
│ Description *                    │
│ [ What did you observe?       ]  │
│ [                              ]  │
│                                  │
│ Priority                         │
│ [ Low ] [ Medium ] [ High ]      │
│                                  │
│ Location                         │
│ [ Use current GPS location     ] │
│ GPS: Waiting / Captured / Denied │
│ [ Latitude ] [ Longitude ]       │
│ [ Manual landmark / instructions]│
│ Source: GPS / Manual             │
│                                  │
│ [ Save draft ] [ Submit report ] │
└──────────────────────────────────┘
```

Flow:

1. Request GPS only after the worker taps the GPS action.
2. Display accuracy and capture time when a fix is available.
3. If denied or unavailable, keep the form usable and focus manual fields.
4. Commit locally before showing the resulting status.
5. Navigate to the queue with a confirmation such as `Report saved locally`.

### 5.2 Queue Manager

```text
┌──────────────────────────────────┐
│ Report queue                     │
│ 3 pending · 1 failed · [Sync now]│
├──────────────────────────────────┤
│ [!] FAILED                       │
│ Water leak · High                │
│ “Description is required”        │
│ [Open] [Retry after fixing]      │
├──────────────────────────────────┤
│ [↻] PENDING SYNC                 │
│ Damaged barrier · Medium         │
│ Saved 10:42 · Retry 2            │
│ [Retry]                          │
└──────────────────────────────────┘
```

Manual Retry is always explicit, disabled while the item is actively syncing, and reports its result inline.

### 5.3 Coordinator Review and Transition

```text
Dashboard: [Status v] [Priority v] [Category v] [Search]
┌──────┬──────────────┬────────┬──────────┬─────────┐
│ ID   │ Summary      │ Status │ Priority │ Updated │
├──────┼──────────────┼────────┼──────────┼─────────┤
│ ...  │ Road damage  │Submitted│ High    │ 10:42   │
└──────┴──────────────┴────────┴──────────┴─────────┘

Transition modal
┌──────────────────────────────────┐
│ Move “Road damage”                │
│ Current: Submitted                │
│ New status: [ Assigned       v ]  │
│ Assignee:  [ Select          v ]  │
│ Note:       [ Optional/required ] │
│                                  │
│ [ Cancel ]          [ Confirm ]   │
└──────────────────────────────────┘
```

For `Rejected`, the note is required and the modal states that rejection is permanent for this report unless a follow-up is created. A 409 refreshes the detail panel and explains that another user changed the report.

## 6. Accessibility and Field Ergonomics

- Minimum touch target: 48×48 CSS px with 8 px spacing.
- Text and controls target WCAG AA contrast; do not use red/green alone.
- Visible focus ring and full keyboard operation for desktop.
- Labels are persistent, not placeholder-only.
- Error summary appears before the form fields and each invalid field has an inline message.
- Support zoom to 200% without loss of core functionality.
- Use `aria-live="polite"` for sync updates and `aria-live="assertive"` only for blocking errors.
- Avoid motion as the sole progress signal; use text and determinate counts.
- Keep primary actions within thumb reach on mobile.
- Use large line height and concise instructions suitable for low visibility.
- Preserve entered text after validation failure or network failure.

## 7. Content and Interaction Rules

Use plain language: `Saved on this device`, not `IndexedDB write succeeded`. Never say `Submitted` when only a local transaction completed. Destructive or irreversible actions require a confirmation that names the report and consequence.

