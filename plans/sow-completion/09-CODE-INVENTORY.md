# Actual code locators and snapshot inventory

Prepared 09 Oct 2026; git HEAD `82f59253d34f8f9c5a2fd872b073de34737ae9b6`. This is a **working-tree source snapshot**, not a clean-commit or production assertion.

`code-inventory.json` contains SHA-256/line count/export-symbol locators for 323 source/config/test files and 153 TypeScript-AST route declarations. The route table resolves local guard/builder declarations; it is a locator, not a substitute for the generated OpenAPI contract or a proof of permission/ownership. Read handlers and generated schema before modification. Object literals are captured; dynamic declarations could require manual inspection.

## Registered module boundary

`backend/src/api/router.ts` registers system/auth/settings/rbac/attendance/workflows/employees/leave/letters/policies/reports/lifecycle/audit/assets/helpdesk/engagement. Payroll/loans/claims/travel/ATS business routers are absent from that file at this snapshot. Do not infer them from workflow codes or pending frontend pages.

## Domain service entry points

| Module | Actual file | Export symbols and source lines |
|---|---|---|
| assets | `backend/src/modules/assets/assets.router.ts` | `assetsRouter:312` |
| assets | `backend/src/modules/assets/assets.service.ts` | `AssetRow:25`, `listAssets:68`, `upsertAsset:178`, `assignAsset:254`, `returnAsset:335`, `assetsHeldByEmployee:402`, `nonReturnedByLeavers:424`, `logMaintenance:449`, `assetMaintenance:509` |
| assets | `backend/src/modules/assets/index.ts` |  |
| attendance | `backend/src/modules/attendance/absence.router.ts` | `absenceRouter:97` |
| attendance | `backend/src/modules/attendance/absence.service.ts` | `AbsenceCaseRow:25`, `AbsenceScanResult:59`, `runAbsenceScan:68`, `setAbsenceCaseStage:191`, `issueAbsenceCaseLetter:219`, `listAbsenceCases:250` |
| attendance | `backend/src/modules/attendance/attendance-config.router.ts` | `attendanceConfigRouter:487` |
| attendance | `backend/src/modules/attendance/attendance-requests.router.ts` | `attendanceRequestsRouter:188` |
| attendance | `backend/src/modules/attendance/attendance.router.ts` | `attendanceRouter:197` |
| attendance | `backend/src/modules/attendance/day-status.service.ts` | `AttendancePolicy:34`, `loadAttendancePolicy:45`, `ResolvedShift:60`, `resolveDay:70`, `FinalizationHoldReason:137`, `AbsenceFinalizationReadiness:142`, `FinalizationHold:149`, `getAbsenceFinalizationReadiness:174`, `ComputedDay:283`, `computeDayStatus:303`, `recomputeDay:392`, `listFinalizationHolds:505`, `drainRecomputeQueue:552`, `setManualStatus:586`, `closeWeek:638` |
| attendance | `backend/src/modules/attendance/index.ts` |  |
| attendance | `backend/src/modules/attendance/ingest.service.ts` | `IngestSummary:25`, `ingestOnce:33`, `reingestQuarantined:229`, `SilentDevice:280`, `findSilentDevices:286`, `alertSilentDevices:308` |
| attendance | `backend/src/modules/attendance/kent-connector.ts` | `RawSwipe:9`, `DeviceInfo:19`, `KentConnector:30`, `MockKentOptions:47`, `MockKentConnector:65` |
| attendance | `backend/src/modules/attendance/kent-sync.job.ts` | `KENT_SOURCE:17`, `KentSyncResult:37`, `runKentSync:42` |
| attendance | `backend/src/modules/attendance/manager-approval.service.ts` | `ManagerApprovalRow:22`, `listManagersWithReports:38`, `getManagerApprovalLedger:72`, `countPendingManagerApprovals:125`, `approveManagerMonth:135` |
| attendance | `backend/src/modules/attendance/month-lock.service.ts` | `ChecklistItem:12`, `MonthLockChecklist:19`, `getMonthLockChecklist:39`, `lockMonth:219`, `isMonthLocked:271` |
| attendance | `backend/src/modules/attendance/overtime.service.ts` | `OvertimePolicy:35`, `recordDetectedOvertime:46`, `applyOvertimeOnFinal:164`, `DecideOvertimeParams:185`, `decideOvertime:201`, `lapseExpiredOvertime:290`, `sendOvertimeSummaries:304`, `listPendingOvertime:325`, `listMyOvertime:336` |
| attendance | `backend/src/modules/attendance/regularization.service.ts` | `RegularizationKind:28`, `CreateRegularizationParams:44`, `createRegularization:57`, `applyRegularizationOnFinal:153`, `RegularizationRow:194`, `listRegularizations:197` |
| attendance | `backend/src/modules/attendance/roster.service.ts` | `RosterPersistenceEntry:12`, `applyRosterEntries:25` |
| attendance | `backend/src/modules/attendance/session-status.ts` | `sessionStatusesSchema:6`, `SessionStatuses:10`, `readSessionStatuses:12`, `validateSessionSummary:19`, `attendanceGlyph:28` |
| attendance | `backend/src/modules/attendance/workflow-hooks.ts` | `registerAttendanceWorkflowHooks:13` |
| audit | `backend/src/modules/audit/audit.router.ts` | `auditRouter:140` |
| audit | `backend/src/modules/audit/audit.service.ts` | `AuditQuery:10`, `AuditEntry:21`, `auditScopeSql:36`, `listAuditPage:42` |
| audit | `backend/src/modules/audit/index.ts` |  |
| auth | `backend/src/modules/auth/auth.repository.ts` | `UserRow:5`, `findUserByIdentifier:11`, `findUserById:23`, `recordLoginSuccess:28`, `recordLoginFailure:41` |
| auth | `backend/src/modules/auth/auth.router.ts` | `authRouter:123` |
| auth | `backend/src/modules/auth/auth.service.ts` | `LoginResult:19`, `login:23`, `RefreshResult:73`, `refresh:78`, `hashPassword:96` |
| auth | `backend/src/modules/auth/index.ts` |  |
| employees | `backend/src/modules/employees/employees.repository.ts` | `DirectoryFilters:8`, `DirectoryRow:28`, `EmployeeProfileRow:41`, `countDirectory:138`, `listDirectory:153`, `findByEcode:244`, `findById:252` |
| employees | `backend/src/modules/employees/employees.router.ts` | `employeesRouter:181` |
| employees | `backend/src/modules/employees/employees.service.ts` | `AuthedUser:20`, `DirectoryItem:22`, `DirectoryResult:33`, `EmployeeProfile:40`, `canViewStatutoryIds:94`, `statusLabel:104`, `listEmployees:134`, `getEmployeeByEcode:232`, `getOwnProfile:256`, `DirectoryFacets:286`, `listDirectoryFacets:303` |
| employees | `backend/src/modules/employees/import.schemas.ts` | `COMPANY_ALIASES:9`, `ECODE_PATTERN:28`, `emsUserSchema:30`, `EmsUserRow:46`, `greythrRowSchema:48`, `GreythrRow:63`, `ImportException:65` |
| employees | `backend/src/modules/employees/import.service.ts` | `EmsImportSummary:19`, `importEmsSeed:56`, `EnrichSummary:181`, `importGreythrEnrich:186` |
| employees | `backend/src/modules/employees/index.ts` |  |
| engagement | `backend/src/modules/engagement/announcements.service.ts` | `AnnouncementRow:16`, `PublishAnnouncementParams:26`, `publishAnnouncement:34`, `listAllAnnouncements:63`, `listAnnouncementsForUser:82`, `withdrawAnnouncement:113` |
| engagement | `backend/src/modules/engagement/audience.ts` | `Db:12`, `EngagementAudience:14`, `audienceIncludesUser:39`, `toAudience:59` |
| engagement | `backend/src/modules/engagement/engagement.router.ts` | `engagementRouter:217` |
| engagement | `backend/src/modules/engagement/index.ts` |  |
| engagement | `backend/src/modules/engagement/polls.service.ts` | `PollRow:23`, `PollResultRow:36`, `CreatePollParams:66`, `createPoll:76`, `listPollsForUser:107`, `RespondToPollParams:156`, `respondToPoll:164`, `pollResults:217`, `closePoll:262` |
| helpdesk | `backend/src/modules/helpdesk/helpdesk.router.ts` | `helpdeskRouter:240` |
| helpdesk | `backend/src/modules/helpdesk/helpdesk.service.ts` | `TicketRow:22`, `listCategories:62`, `raiseTicket:83`, `listTickets:167`, `ticketThread:244`, `replyToTicket:267`, `setTicketStatus:307`, `escalateBreachedTickets:368`, `helpdeskPerformance:404` |
| helpdesk | `backend/src/modules/helpdesk/index.ts` |  |
| leave | `backend/src/modules/leave/index.ts` |  |
| leave | `backend/src/modules/leave/leave-apply.service.ts` | `computeLeaveSpan:32`, `ApplyLeaveParams:80`, `applyForLeave:91`, `applyLeaveOnFinal:178`, `requestCancellation:241`, `applyCancelOnFinal:273`, `requestEncashment:323`, `applyEncashmentOnFinal:352`, `selectRestrictedHoliday:386`, `applyRhOnFinal:431` |
| leave | `backend/src/modules/leave/leave-core.service.ts` | `LeaveTypeRow:16`, `getLeaveType:18`, `getBalance:27`, `getBalances:57`, `runMonthlyAccrual:73`, `compOffDaysForMinutes:113`, `creditCompOffForOvertime:124`, `runCompOffExpiry:163`, `runYearEndCarryForward:201`, `adjustBalance:239` |
| leave | `backend/src/modules/leave/leave.router.ts` | `leaveRouter:361` |
| leave | `backend/src/modules/leave/workflow-hooks.ts` | `registerLeaveWorkflowHooks:11` |
| letters | `backend/src/modules/letters/index.ts` |  |
| letters | `backend/src/modules/letters/letters.router.ts` | `lettersRouter:145` |
| letters | `backend/src/modules/letters/letters.service.ts` | `LetterRow:19`, `LetterTemplateRow:20`, `renderTemplate:48`, `IssueLetterParams:61`, `issueLetter:72`, `applyLetterOnFinal:142`, `listLetters:170` |
| letters | `backend/src/modules/letters/workflow-hooks.ts` | `registerLettersWorkflowHooks:10` |
| lifecycle | `backend/src/modules/lifecycle/boarding-exit.service.ts` | `BoardingRow:17`, `ExitRow:29`, `BoardingExitReport:33`, `boardingExitReport:42`, `boardingExitExcel:150`, `sendBoardingExitEmail:157` |
| lifecycle | `backend/src/modules/lifecycle/index.ts` |  |
| lifecycle | `backend/src/modules/lifecycle/lifecycle.router.ts` | `lifecycleRouter:56` |
| notifications | `backend/src/modules/notifications/index.ts` |  |
| notifications | `backend/src/modules/notifications/notifications.repository.ts` | `NotificationRow:6`, `EnqueueInput:8`, `insertNotification:16`, `claimDeliverable:32`, `markSent:44`, `markFailed:52`, `listSubscribers:69` |
| notifications | `backend/src/modules/notifications/notifications.service.ts` | `NotificationTransport:22`, `devLogTransport:27`, `enqueue:38`, `enqueueEvent:47`, `processQueue:91` |
| policies | `backend/src/modules/policies/index.ts` |  |
| policies | `backend/src/modules/policies/policies.router.ts` | `policiesRouter:222` |
| policies | `backend/src/modules/policies/policies.service.ts` | `PolicyAudience:18`, `PublishPolicyParams:33`, `publishPolicy:48`, `listPoliciesFor:90`, `listActivePolicies:125`, `myPendingPolicies:143`, `acknowledgePolicy:148`, `policyAckStatus:158`, `runPolicyAckNag:197`, `PolicyAckReportRow:249`, `policyAckReport:261` |
| rbac | `backend/src/modules/rbac/index.ts` |  |
| rbac | `backend/src/modules/rbac/rbac.guard.ts` | `assertDelegationCeiling:6`, `assertRoleDelegation:25` |
| rbac | `backend/src/modules/rbac/rbac.repository.ts` | `listRoles:5`, `listPermissions:9`, `listGrants:14`, `findRoleByCode:25`, `findPermissionByCode:29`, `insertGrant:33`, `deleteGrant:49`, `assignRoleToUser:58`, `removeRoleFromUser:71`, `searchUsersWithRoles:86` |
| rbac | `backend/src/modules/rbac/rbac.router.ts` | `rbacRouter:210` |
| reports | `backend/src/modules/reports/dashboard.service.ts` | `hrOpsDashboard:12`, `essHome:116`, `myAttendanceMonth:181`, `teamMonthGrid:210`, `BusinessUnitDashboard:285`, `businessUnitDashboard:298` |
| reports | `backend/src/modules/reports/index.ts` |  |
| reports | `backend/src/modules/reports/kpi-snapshot.service.ts` | `KpiSnapshot:32`, `buildKpiSnapshot:48`, `readKpiSnapshot:286`, `kpiTrend:330` |
| reports | `backend/src/modules/reports/muster.service.ts` | `MusterFilters:20`, `MusterRow:38`, `buildMusterMonth:66`, `listMuster:268`, `exportMusterExcel:366` |
| reports | `backend/src/modules/reports/reports-export.service.ts` | `exportR2Excel:134`, `exportR3Excel:146`, `exportR4Excel:164`, `exportR5Excel:177`, `exportR6Excel:186`, `exportR24Excel:198`, `exportR27Excel:209` |
| reports | `backend/src/modules/reports/reports.router.ts` | `reportsRouter:792` |
| reports | `backend/src/modules/reports/reports.service.ts` | `R2Row:21`, `reportR2Swipes:41`, `R2RawSwipeRow:200`, `reportR2RawSwipes:221`, `R3Row:279`, `R3TimelineStep:297`, `reportR3Regularizations:308`, `R4Row:421`, `reportR4Exceptions:434`, `R5Row:488`, `reportR5Ot:509`, `R6Row:602`, `reportR6AbsenceCases:617`, `BoardingReportRow:682`, `reportR24Boarding:696`, `R27Row:762`, `reportR27Headcount:776` |
| settings | `backend/src/modules/settings/index.ts` |  |
| settings | `backend/src/modules/settings/seed.ts` | `POLICY_SETTINGS:30`, `seedPolicySettings:184` |
| settings | `backend/src/modules/settings/settings.repository.ts` | `SettingRow:5`, `getSetting:9`, `listSettings:13`, `upsertSetting:17` |
| settings | `backend/src/modules/settings/settings.router.ts` | `settingsRouter:64` |
| settings | `backend/src/modules/settings/settings.service.ts` | `SettingType:19`, `getTypedSetting:22`, `setSetting:38` |
| system | `backend/src/modules/system/index.ts` |  |
| system | `backend/src/modules/system/system.router.ts` | `systemRouter:23` |
| workflows | `backend/src/modules/workflows/definitions.seed.ts` | `DefinitionSeed:12`, `WORKFLOW_DEFINITIONS:25` |
| workflows | `backend/src/modules/workflows/index.ts` |  |
| workflows | `backend/src/modules/workflows/seed.ts` |  |
| workflows | `backend/src/modules/workflows/workflow.service.ts` | `stepSpecSchema:31`, `StepSpec:40`, `stepsSchema:41`, `RequestRow:43`, `StepRow:44`, `WorkflowFinalStatus:53`, `WorkflowFinalHook:54`, `onWorkflowFinal:58`, `clearWorkflowFinalHooks:65`, `createRequest:231`, `ActOutcome:258`, `act:260`, `resubmit:323`, `runEscalations:343`, `inbox:430`, `timeline:463` |
| workflows | `backend/src/modules/workflows/workflows.router.ts` | `workflowsRouter:261` |

## API route declarations

Paths below are literal procedure paths; inspect the central middleware prefix for the full HTTP URL. Permission locator does not certify runtime scope. All proposed payroll/lifecycle/travel APIs in the cards must be implemented and registered before a frontend client can call them.

| Method | Literal path | Declared tier/code locator | Source |
|---|---|---|---|
| GET | `/assets` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:56` |
| PUT | `/assets/{assetNo}` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:75` |
| POST | `/assets/{assetId}/assign` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:104` |
| POST | `/assets/assignments/{assignmentId}/return` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:130` |
| GET | `/assets/held-by/{employeeId}` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:153` |
| GET | `/assets/non-returned` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:171` |
| GET | `/assets/{assetId}/maintenance` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:190` |
| POST | `/assets/{assetId}/maintenance` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:209` |
| GET | `/assets/export` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:241` |
| GET | `/assets/non-returned/export` | `withPermission: assets.manage` | `backend/src/modules/assets/assets.router.ts:285` |
| GET | `/attendance/absence-cases` | `withPermission: attendance.team.read` | `backend/src/modules/attendance/absence.router.ts:21` |
| POST | `/attendance/absence-cases/{id}/stage` | `withPermission: letters.issue` | `backend/src/modules/attendance/absence.router.ts:56` |
| POST | `/attendance/absence-cases/{id}/letter` | `withPermission: letters.issue` | `backend/src/modules/attendance/absence.router.ts:69` |
| POST | `/attendance/absence-cases/scan` | `withPermission: admin.integrations` | `backend/src/modules/attendance/absence.router.ts:92` |
| GET | `/attendance/config/shifts` | `withPermission: admin.settings` | `backend/src/modules/attendance/attendance-config.router.ts:80` |
| GET | `/attendance/config/shifts/active` | `withPermission: attendance.roster.write` | `backend/src/modules/attendance/attendance-config.router.ts:89` |
| PUT | `/attendance/config/shifts/{code}` | `withPermission: admin.settings` | `backend/src/modules/attendance/attendance-config.router.ts:122` |
| GET | `/attendance/config/holidays` | `withPermission: attendance.own` | `backend/src/modules/attendance/attendance-config.router.ts:157` |
| PUT | `/attendance/config/holidays` | `withPermission: admin.settings` | `backend/src/modules/attendance/attendance-config.router.ts:176` |
| PUT | `/attendance/config/schemes/{employeeId}` | `withPermission: attendance.roster.write` | `backend/src/modules/attendance/attendance-config.router.ts:201` |
| GET | `/attendance/roster` | `withPermission: attendance.roster.write` | `backend/src/modules/attendance/attendance-config.router.ts:233` |
| PUT | `/attendance/roster` | `withPermission: attendance.roster.write` | `backend/src/modules/attendance/attendance-config.router.ts:317` |
| GET | `/attendance/days` | `withPermission: attendance.team.read` | `backend/src/modules/attendance/attendance-config.router.ts:390` |
| PUT | `/attendance/days/override` | `withPermission: attendance.manual_override` | `backend/src/modules/attendance/attendance-config.router.ts:434` |
| POST | `/attendance/recompute` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance-config.router.ts:463` |
| POST | `/attendance/week-close` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance-config.router.ts:480` |
| POST | `/attendance/requests` | `withPermission: attendance.own` | `backend/src/modules/attendance/attendance-requests.router.ts:47` |
| GET | `/attendance/requests/mine` | `withPermission: attendance.own` | `backend/src/modules/attendance/attendance-requests.router.ts:78` |
| GET | `/attendance/ot/mine` | `withPermission: attendance.own` | `backend/src/modules/attendance/attendance-requests.router.ts:140` |
| GET | `/attendance/ot/pending` | `withPermission: ot.approve` | `backend/src/modules/attendance/attendance-requests.router.ts:148` |
| POST | `/attendance/ot/decide` | `withPermission: ot.approve` | `backend/src/modules/attendance/attendance-requests.router.ts:156` |
| POST | `/attendance/ot/lapse-sweep` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance-requests.router.ts:182` |
| GET | `/attendance/devices` | `withPermission: admin.devices` | `backend/src/modules/attendance/attendance.router.ts:18` |
| GET | `/attendance/finalization-holds` | `withPermission: reports.hr` | `backend/src/modules/attendance/attendance.router.ts:58` |
| GET | `/attendance/exceptions/unmatched` | `withPermission: attendance.manual_override` | `backend/src/modules/attendance/attendance.router.ts:86` |
| GET | `/attendance/exceptions/quarantined` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance.router.ts:125` |
| POST | `/attendance/sync` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance.router.ts:164` |
| POST | `/attendance/exceptions/quarantined/reingest` | `withPermission: admin.integrations` | `backend/src/modules/attendance/attendance.router.ts:186` |
| GET | `/audit` | `withPermission: audit.read` | `backend/src/modules/audit/audit.router.ts:45` |
| GET | `/audit/facets` | `withPermission: audit.read` | `backend/src/modules/audit/audit.router.ts:66` |
| GET | `/audit/verify` | `withPermission: audit.read` | `backend/src/modules/audit/audit.router.ts:79` |
| GET | `/audit/export` | `withPermission: audit.read` | `backend/src/modules/audit/audit.router.ts:98` |
| POST | `/auth/login` | `base` | `backend/src/modules/auth/auth.router.ts:41` |
| POST | `/auth/refresh` | `base` | `backend/src/modules/auth/auth.router.ts:71` |
| POST | `/auth/logout` | `base` | `backend/src/modules/auth/auth.router.ts:87` |
| GET | `/auth/me` | `authed` | `backend/src/modules/auth/auth.router.ts:103` |
| GET | `/employees` | `withPermission: employee.read` | `backend/src/modules/employees/employees.router.ts:30` |
| GET | `/employees/me` | `withPermission: employee.read` | `backend/src/modules/employees/employees.router.ts:116` |
| GET | `/employees/{ecode}` | `withPermission: employee.read` | `backend/src/modules/employees/employees.router.ts:133` |
| GET | `/employees/facets` | `withPermission: employee.read` | `backend/src/modules/employees/employees.router.ts:161` |
| GET | `/engagement/announcements` | `authed` | `backend/src/modules/engagement/engagement.router.ts:79` |
| GET | `/engagement/announcements/all` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:88` |
| POST | `/engagement/announcements` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:97` |
| POST | `/engagement/announcements/{id}/withdraw` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:120` |
| GET | `/engagement/polls` | `authed` | `backend/src/modules/engagement/engagement.router.ts:139` |
| POST | `/engagement/polls` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:144` |
| POST | `/engagement/polls/{id}/respond` | `authed` | `backend/src/modules/engagement/engagement.router.ts:168` |
| GET | `/engagement/polls/{id}/results` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:193` |
| POST | `/engagement/polls/{id}/close` | `withPermission: engagement.publish` | `backend/src/modules/engagement/engagement.router.ts:205` |
| GET | `/helpdesk/categories` | `authed` | `backend/src/modules/helpdesk/helpdesk.router.ts:55` |
| POST | `/helpdesk/tickets` | `authed` | `backend/src/modules/helpdesk/helpdesk.router.ts:71` |
| GET | `/helpdesk/tickets/mine` | `authed` | `backend/src/modules/helpdesk/helpdesk.router.ts:94` |
| GET | `/helpdesk/tickets` | `withPermission: helpdesk.agent` | `backend/src/modules/helpdesk/helpdesk.router.ts:102` |
| GET | `/helpdesk/tickets/{ticketId}/thread` | `authed` | `backend/src/modules/helpdesk/helpdesk.router.ts:126` |
| POST | `/helpdesk/tickets/{ticketId}/reply` | `authed` | `backend/src/modules/helpdesk/helpdesk.router.ts:149` |
| POST | `/helpdesk/tickets/{ticketId}/status` | `withPermission: helpdesk.agent` | `backend/src/modules/helpdesk/helpdesk.router.ts:176` |
| POST | `/helpdesk/escalate` | `withPermission: admin.integrations` | `backend/src/modules/helpdesk/helpdesk.router.ts:198` |
| GET | `/helpdesk/performance` | `withPermission: reports.hr` | `backend/src/modules/helpdesk/helpdesk.router.ts:215` |
| GET | `/helpdesk/performance/export` | `withPermission: reports.hr` | `backend/src/modules/helpdesk/helpdesk.router.ts:221` |
| GET | `/leave/types` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:45` |
| PUT | `/leave/types/{code}` | `withPermission: leave.admin` | `backend/src/modules/leave/leave.router.ts:65` |
| GET | `/leave/balances` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:118` |
| GET | `/leave/balances/{employeeId}` | `withPermission: leave.admin` | `backend/src/modules/leave/leave.router.ts:123` |
| POST | `/leave/applications` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:129` |
| GET | `/leave/applications/mine` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:159` |
| GET | `/leave/ledger` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:194` |
| POST | `/leave/applications/{id}/cancel` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:238` |
| POST | `/leave/encashments` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:255` |
| GET | `/leave/restricted-holidays` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:273` |
| PUT | `/leave/restricted-holidays` | `withPermission: leave.admin` | `backend/src/modules/leave/leave.router.ts:288` |
| POST | `/leave/restricted-holidays/{id}/select` | `withPermission: leave.own` | `backend/src/modules/leave/leave.router.ts:309` |
| POST | `/leave/adjustments` | `withPermission: leave.admin` | `backend/src/modules/leave/leave.router.ts:326` |
| POST | `/leave/accrual/run` | `withPermission: admin.integrations` | `backend/src/modules/leave/leave.router.ts:345` |
| POST | `/leave/comp-off/expire` | `withPermission: admin.integrations` | `backend/src/modules/leave/leave.router.ts:351` |
| POST | `/leave/year-end/run` | `withPermission: admin.integrations` | `backend/src/modules/leave/leave.router.ts:356` |
| GET | `/letters/templates` | `withPermission: letters.issue` | `backend/src/modules/letters/letters.router.ts:36` |
| PUT | `/letters/templates/{code}` | `withPermission: letters.issue` | `backend/src/modules/letters/letters.router.ts:49` |
| POST | `/letters/issue` | `withPermission: letters.issue` | `backend/src/modules/letters/letters.router.ts:85` |
| GET | `/letters/mine` | `withPermission: employee.read` | `backend/src/modules/letters/letters.router.ts:108` |
| GET | `/letters/employee/{employeeId}` | `withPermission: letters.issue` | `backend/src/modules/letters/letters.router.ts:116` |
| GET | `/letters/{id}/content` | `withPermission: employee.read` | `backend/src/modules/letters/letters.router.ts:122` |
| GET | `/lifecycle/boarding-exit` | `withPermission: reports.hr` | `backend/src/modules/lifecycle/lifecycle.router.ts:25` |
| POST | `/lifecycle/boarding-exit/send` | `withPermission: admin.integrations` | `backend/src/modules/lifecycle/lifecycle.router.ts:38` |
| GET | `/lifecycle/boarding-exit/excel` | `withPermission: reports.hr` | `backend/src/modules/lifecycle/lifecycle.router.ts:44` |
| POST | `/policies` | `withPermission: engagement.publish` | `backend/src/modules/policies/policies.router.ts:47` |
| GET | `/policies` | `withPermission: employee.read` | `backend/src/modules/policies/policies.router.ts:89` |
| GET | `/policies/pending` | `withPermission: employee.read` | `backend/src/modules/policies/policies.router.ts:94` |
| GET | `/policies/catalog` | `withPermission: reports.hr` | `backend/src/modules/policies/policies.router.ts:99` |
| GET | `/policies/{id}/content` | `withPermission: employee.read` | `backend/src/modules/policies/policies.router.ts:115` |
| POST | `/policies/{id}/ack` | `withPermission: employee.read` | `backend/src/modules/policies/policies.router.ts:134` |
| GET | `/policies/ack-status` | `withPermission: reports.hr` | `backend/src/modules/policies/policies.router.ts:143` |
| POST | `/policies/nag` | `withPermission: admin.integrations` | `backend/src/modules/policies/policies.router.ts:159` |
| GET | `/policies/ack-report` | `withPermission: reports.hr` | `backend/src/modules/policies/policies.router.ts:186` |
| GET | `/policies/ack-report/export` | `withPermission: reports.hr` | `backend/src/modules/policies/policies.router.ts:192` |
| GET | `/rbac/matrix` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:31` |
| POST | `/rbac/grants` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:66` |
| DELETE | `/rbac/grants` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:94` |
| POST | `/rbac/user-roles` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:123` |
| DELETE | `/rbac/user-roles` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:154` |
| GET | `/rbac/users` | `withPermission: admin.roles` | `backend/src/modules/rbac/rbac.router.ts:183` |
| GET | `/attendance/month-lock/checklist` | `withPermission: attendance.month_lock` | `backend/src/modules/reports/reports.router.ts:104` |
| POST | `/attendance/month-lock` | `withPermission: attendance.month_lock` | `backend/src/modules/reports/reports.router.ts:125` |
| GET | `/attendance/manager-approvals` | `withPermission: attendance.month_lock` | `backend/src/modules/reports/reports.router.ts:153` |
| POST | `/attendance/manager-approvals` | `withPermission: attendance.team.read` | `backend/src/modules/reports/reports.router.ts:170` |
| POST | `/reports/muster/build` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:214` |
| GET | `/reports/muster` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:266` |
| GET | `/reports/muster/export` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:274` |
| GET | `/reports/r2-swipes` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:325` |
| GET | `/reports/r2-swipes/export` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:333` |
| GET | `/reports/r2-swipes/raw` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:362` |
| GET | `/reports/r3-regularizations` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:403` |
| GET | `/reports/r3-regularizations/export` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:411` |
| GET | `/reports/r4-exceptions` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:435` |
| GET | `/reports/r4-exceptions/export` | `withPermission: attendance.muster.export` | `backend/src/modules/reports/reports.router.ts:443` |
| GET | `/reports/r5-ot` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:476` |
| GET | `/reports/r5-ot/export` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:484` |
| GET | `/reports/r6-absence` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:514` |
| GET | `/reports/r6-absence/export` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:522` |
| GET | `/reports/r24-boarding` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:554` |
| GET | `/reports/r24-boarding/export` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:562` |
| GET | `/reports/r27-headcount` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:603` |
| GET | `/reports/r27-headcount/export` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:611` |
| GET | `/dashboards/hr-ops` | `withPermission: reports.hr` | `backend/src/modules/reports/reports.router.ts:624` |
| GET | `/dashboards/ess` | `withPermission: attendance.own` | `backend/src/modules/reports/reports.router.ts:641` |
| GET | `/my/attendance` | `withPermission: attendance.own` | `backend/src/modules/reports/reports.router.ts:670` |
| GET | `/my/team/grid` | `withPermission: attendance.team.read` | `backend/src/modules/reports/reports.router.ts:686` |
| GET | `/reports/executive` | `withPermission: reports.ceo` | `backend/src/modules/reports/reports.router.ts:710` |
| GET | `/dashboards/business-unit` | `withAnyPermission: reports.bu,reports.hr` | `backend/src/modules/reports/reports.router.ts:743` |
| GET | `/reports/executive/trend` | `withAnyPermission: reports.hr,reports.bu,reports.ceo` | `backend/src/modules/reports/reports.router.ts:773` |
| POST | `/reports/executive/rebuild` | `withPermission: admin.integrations` | `backend/src/modules/reports/reports.router.ts:785` |
| GET | `/settings/{key}` | `authed` | `backend/src/modules/settings/settings.router.ts:20` |
| GET | `/settings` | `authed` | `backend/src/modules/settings/settings.router.ts:30` |
| PUT | `/settings/{key}` | `withPermission: admin.settings` | `backend/src/modules/settings/settings.router.ts:43` |
| GET | `/system/health` | `base` | `backend/src/modules/system/system.router.ts:15` |
| POST | `/workflows/requests` | `authed` | `backend/src/modules/workflows/workflows.router.ts:21` |
| GET | `/workflows/inbox` | `authed` | `backend/src/modules/workflows/workflows.router.ts:50` |
| POST | `/workflows/requests/{requestId}/act` | `authed` | `backend/src/modules/workflows/workflows.router.ts:83` |
| POST | `/workflows/requests/{requestId}/resubmit` | `authed` | `backend/src/modules/workflows/workflows.router.ts:110` |
| GET | `/workflows/requests/{requestId}` | `authed` | `backend/src/modules/workflows/workflows.router.ts:124` |
| PUT | `/workflows/delegations` | `authed` | `backend/src/modules/workflows/workflows.router.ts:180` |
| GET | `/workflows/definitions` | `withPermission: admin.settings` | `backend/src/modules/workflows/workflows.router.ts:212` |
| PUT | `/workflows/definitions/{code}` | `withPermission: admin.settings` | `backend/src/modules/workflows/workflows.router.ts:221` |
| POST | `/workflows/escalate` | `withPermission: admin.integrations` | `backend/src/modules/workflows/workflows.router.ts:254` |

## Typed database relations

61 entries detected in the current `Database` interface; source migrations/types are not a full historical deployed-schema inventory. Compare bundled `docs/recon/database-relationships-2026-10-07.md` and dated audit under F01/D11. Missing governing schema/source is a blocker, not permission to reverse-engineer a new business rule from a table.

| Relation | Typed interface | Line in core/db/types.ts |
|---|---|---|
| `core.users` | `UsersTable` | 912 |
| `core.roles` | `RolesTable` | 913 |
| `core.permissions` | `PermissionsTable` | 914 |
| `core.role_permissions` | `RolePermissionsTable` | 915 |
| `core.user_roles` | `UserRolesTable` | 916 |
| `core.audit_log` | `AuditLogTable` | 917 |
| `reporting.kpi_daily` | `KpiDailyTable` | 918 |
| `hd.categories` | `HdCategoriesTable` | 919 |
| `hd.tickets` | `HdTicketsTable` | 920 |
| `hd.ticket_messages` | `HdTicketMessagesTable` | 921 |
| `eng.announcements` | `EngAnnouncementsTable` | 922 |
| `eng.polls` | `EngPollsTable` | 923 |
| `eng.poll_responses` | `EngPollResponsesTable` | 924 |
| `ast.assets` | `AssetsTable` | 925 |
| `ast.assignments` | `AssetAssignmentsTable` | 926 |
| `ast.maintenance` | `AssetMaintenanceTable` | 927 |
| `core.settings` | `SettingsTable` | 928 |
| `core.companies` | `CompaniesTable` | 929 |
| `core.locations` | `LocationsTable` | 930 |
| `core.cost_centers` | `CostCentersTable` | 931 |
| `core.departments` | `DepartmentsTable` | 932 |
| `core.org_units` | `OrgUnitsTable` | 933 |
| `core.designations` | `DesignationsTable` | 934 |
| `core.grades` | `GradesTable` | 935 |
| `core.employees` | `EmployeesTable` | 936 |
| `core.reporting_tree` | `ReportingTreeTable` | 937 |
| `core.employee_history` | `EmployeeHistoryTable` | 938 |
| `core.employee_family` | `EmployeeFamilyTable` | 939 |
| `core.documents` | `DocumentsTable` | 940 |
| `wf.definitions` | `WfDefinitionsTable` | 941 |
| `wf.requests` | `WfRequestsTable` | 942 |
| `wf.request_steps` | `WfRequestStepsTable` | 943 |
| `wf.delegations` | `WfDelegationsTable` | 944 |
| `wf.notifications` | `NotificationsTable` | 945 |
| `wf.event_subscriptions` | `EventSubscriptionsTable` | 946 |
| `att.devices` | `AttDevicesTable` | 947 |
| `att.ingest_watermarks` | `AttIngestWatermarksTable` | 948 |
| `att.device_watermarks` | `AttDeviceWatermarksTable` | 949 |
| `att.swipe_events` | `AttSwipeEventsTable` | 950 |
| `att.quarantined_swipes` | `AttQuarantinedSwipesTable` | 951 |
| `att.shifts` | `AttShiftsTable` | 952 |
| `att.employee_shifts` | `AttEmployeeShiftsTable` | 953 |
| `att.rosters` | `AttRostersTable` | 954 |
| `att.holidays` | `AttHolidaysTable` | 955 |
| `att.day_records` | `AttDayRecordsTable` | 956 |
| `att.recompute_queue` | `AttRecomputeQueueTable` | 957 |
| `att.regularizations` | `AttRegularizationsTable` | 958 |
| `att.overtime_entries` | `AttOvertimeEntriesTable` | 959 |
| `att.absence_cases` | `AttAbsenceCasesTable` | 960 |
| `att.month_locks` | `AttMonthLocksTable` | 961 |
| `att.manager_month_approvals` | `AttManagerMonthApprovalsTable` | 962 |
| `reporting.muster_month` | `ReportingMusterMonthTable` | 963 |
| `lv.leave_types` | `LvLeaveTypesTable` | 964 |
| `lv.ledger` | `LvLedgerTable` | 965 |
| `lv.applications` | `LvApplicationsTable` | 966 |
| `lv.restricted_holidays` | `LvRestrictedHolidaysTable` | 967 |
| `lv.rh_selections` | `LvRhSelectionsTable` | 968 |
| `core.letter_templates` | `LetterTemplatesTable` | 969 |
| `core.letters` | `LettersTable` | 970 |
| `core.policies` | `PoliciesTable` | 971 |
| `core.policy_acknowledgments` | `PolicyAcknowledgmentsTable` | 972 |

## Source migrations

All existing source migration filenames follow. They do not include the missing applied historical files listed in the dated recon. Recover their provenance and compare fresh safe schema before changing a migration chain.

- `backend/migrations/1751790000000_core-auth-rbac-audit-settings.ts` — SHA-256 `d36203029a60f9c295f8f2960e06a93152b3fe890307930bda1d883568b5c82b`
- `backend/migrations/1751800000000_wf-notifications.ts` — SHA-256 `92b753581fc1bfeb61ea619391d6e17a6752e0db7aa65a2bdcacfc8578dfd68f`
- `backend/migrations/1751810000000_org-employees.ts` — SHA-256 `4bc470bf4178f3b5aacaf741c6dc299e32fa68c3baecb13f4368a0218a7905fc`
- `backend/migrations/1751820000000_attendance-ingestion.ts` — SHA-256 `070fb4ae8ec3f3d155fe70befd866dfb77efcf446c604a6d35a18d43d0837c20`
- `backend/migrations/1751830000000_attendance-quarantine.ts` — SHA-256 `da0cbd4575c1f264e426d17556ae006a9737df1562666f880678fd96c405b50f`
- `backend/migrations/1751840000000_attendance-processing.ts` — SHA-256 `44a5d5d0a9bb1b330571b1692aa83729f99ef5cfb6c7f56f00579fe9169b6ab8`
- `backend/migrations/1751850000000_workflow-engine.ts` — SHA-256 `e1cc6904f6f265d239e9cbcfa54e80c1408c3dcd9d6ba5ca232376ef92c08d60`
- `backend/migrations/1751860000000_phase1-review-fixes.ts` — SHA-256 `4c64bcffe79dc08fe09aea5552bb2fda7e13e3a5f1bb513fdd4cdddd5334ead5`
- `backend/migrations/1751870000000_attendance-requests.ts` — SHA-256 `52af4342674dec4dbe2b34a4e66a0a8d628e9385bc595a1b4a0abcd8ebf27067`
- `backend/migrations/1751880000000_leave.ts` — SHA-256 `970363901d7a34c06f8e7a8fa110f73855ac8caf2f8ad4350f026d8f9e317b8b`
- `backend/migrations/1751890000000_absence-letters-policies.ts` — SHA-256 `35d5bc1e329a65bbad2ee618c8779c032e81b385d99ec0b9d03e066d003d443b`
- `backend/migrations/1751900000000_stage17-month-lock-muster.ts` — SHA-256 `54cf7a483850359c90a9e6f18e8cf5c4ab408e4fc0d3a5b62a7c929eef483d9d`
- `backend/migrations/1751910000000_stage17-lock-hardening.ts` — SHA-256 `f9fc9f4b840b64ec98d494ed7e6500c4b507228142a12deb0004c2dbe7d86b56`
- `backend/migrations/1751920000000_per-device-watermarks.ts` — SHA-256 `ced3edff6821f71216947921cac8f62c2a24f3919d02a5e81080682be6a3e14d`
- `backend/migrations/1751930000000_device-watermark-monotonic.ts` — SHA-256 `d8353a23bddbb2d6398947be2fdb91119a4cc0f06a186037021a740f64ba296b`
- `backend/migrations/1751940000000_policy-body-summary.ts` — SHA-256 `77e6ee433291808f0608b9aeaaf7c79839f74c43890242d545deb6eac002f95d`
- `backend/migrations/1751950000000_stage17-schema-drift-fix.ts` — SHA-256 `9ed14d27f252e4762eb7a136548c1143d6ed240f3c54a81899274f2ac2f89e7d`
- `backend/migrations/1751960000000_manager-month-approvals.ts` — SHA-256 `67f209f393c2fa35696366f7aaf9d9e2c690713fa85e062eff4684dbfd0c2e77`
- `backend/migrations/1751970000000_stage17-review-hardening.ts` — SHA-256 `2ebe0a595dd20645706d5ef3a6a24a29b916d32900c4b90f917b2ea73db85387`
- `backend/migrations/1751980000000_assets-module.ts` — SHA-256 `d74bc9fec7bade583dee39b0702eda6eb628c1ec97ba6706ebe752197a267432`
- `backend/migrations/1751990000000_helpdesk-engagement.ts` — SHA-256 `aacdc09ffff220691e63560af144a3f96f5eb495e5747d96cc3b6ace6c12e0c9`
- `backend/migrations/1752000000000_kpi-daily-snapshot.ts` — SHA-256 `88dc7df95eceb456901490695e4d391ce56483bcfa292883e903f55b6f476f9c`
- `backend/migrations/1752010000000_asset-search-trigram.ts` — SHA-256 `415332a8e2dc6721d3dfb044f46ab188a06a523fd7988e53ddedab78f80853f1`
- `backend/migrations/1752020000000_helpdesk-ticket-sequence.ts` — SHA-256 `4db7610b04dd32b430dbb40ca42560c7158accc4c6728cbd62e2f4e5b8dbab26`
- `backend/migrations/1752030000000_roster-noop-approval-guard.ts` — SHA-256 `80f409b408ab3934bc01c02c5e7bcb158001ceec538c84b70c77190895268945`
- `backend/migrations/1752040000000_engagement-anonymous-dedupe.ts` — SHA-256 `5ead33ac70025e2ff6dea6c925aced0be055d175cb05150752190714de526f1b`
- `backend/migrations/1752050000000_audit-org-unit-scope.ts` — SHA-256 `0a6ce14df79c50a8c05db152964f5498f45d40aa9b35908a4ae9373f431d9bbc`
- `backend/migrations/1752200000000_rbac-last-admin-guard.ts` — SHA-256 `73109b940e448d724b0e7209c8c71a2735672fa31f31167114a93618a5592eea`
- `backend/migrations/1752210000000_attendance-session-off.ts` — SHA-256 `cedc49ebbe5beeb8a149a431970c905f0948e5bf82109db83ff2d3cb365538cd`

## Frontend page starting points

| Actual page file | Export / line |
|---|---|
| `frontend/src/pages/_shared/ModuleState.tsx` | `PendingModule:27`, `ModuleHeader:64` |
| `frontend/src/pages/admin/AccessControlPage.tsx` | `AccessControlPage:55` |
| `frontend/src/pages/admin/AttendanceMastersPage.tsx` | `AttendanceMastersPage:73` |
| `frontend/src/pages/admin/AuditLogPage.tsx` | `AuditLogPage:82` |
| `frontend/src/pages/admin/SettingsPage.tsx` | `SettingsPage:77` |
| `frontend/src/pages/admin/WorkflowsPage.tsx` | `WorkflowsPage:97` |
| `frontend/src/pages/approvals/ApprovalsPage.tsx` | `ApprovalsPage:45` |
| `frontend/src/pages/attendance/AbsenceCasesPage.tsx` | `AbsenceCasesPage:111` |
| `frontend/src/pages/attendance/AttendanceOpsPage.tsx` | `AttendanceOpsPage:57` |
| `frontend/src/pages/attendance/AttendanceRequestDrawer.tsx` | `AttendanceRequestDrawer:99` |
| `frontend/src/pages/attendance/DeviceHealthPage.tsx` | `DeviceHealthPage:6` |
| `frontend/src/pages/attendance/ExceptionsPage.tsx` | `ExceptionsPage:25` |
| `frontend/src/pages/attendance/MonthLockPage.tsx` | `MonthLockPage:51` |
| `frontend/src/pages/attendance/MyAttendancePage.tsx` | `MyAttendancePage:135` |
| `frontend/src/pages/auth/LoginPage.tsx` | `LoginPage:74` |
| `frontend/src/pages/dev/GalleryPage.tsx` | `GalleryPage:195` |
| `frontend/src/pages/executive/ExecutivePage.tsx` | `ExecutivePage:196` |
| `frontend/src/pages/home/BusinessUnitDashboard.tsx` | `BusinessUnitDashboard:84` |
| `frontend/src/pages/home/DashboardFeedback.tsx` | `DashboardSkeleton:4`, `DashboardError:28` |
| `frontend/src/pages/home/DeviceHealthDashboard.tsx` | `DeviceHealthDashboard:7` |
| `frontend/src/pages/home/EssDashboard.tsx` | `EssDashboard:206` |
| `frontend/src/pages/home/HrOpsDashboard.tsx` | `HrOpsDashboard:26` |
| `frontend/src/pages/home/ManagerDashboard.tsx` | `ManagerDashboard:52` |
| `frontend/src/pages/home/RoleHomePage.tsx` | `RoleHomePage:140` |
| `frontend/src/pages/leave/LeaveAdminPage.tsx` | `LeaveAdminPage:6` |
| `frontend/src/pages/leave/LeaveApplyDrawer.tsx` | `LeaveTypeOption:67`, `LeaveApplyDrawer:101` |
| `frontend/src/pages/leave/MyLeavePage.tsx` | `MyLeavePage:96` |
| `frontend/src/pages/letters/LettersPage.tsx` | `LettersPage:31` |
| `frontend/src/pages/letters/MyLettersPage.tsx` | `MyLettersPage:41` |
| `frontend/src/pages/lifecycle/LifecyclePage.tsx` | `LifecyclePage:45` |
| `frontend/src/pages/payroll/ClaimsPage.tsx` | `ClaimsPage:43` |
| `frontend/src/pages/payroll/LoansPage.tsx` | `LoansPage:27` |
| `frontend/src/pages/payroll/MyPayPage.tsx` | `MyPayPage:53` |
| `frontend/src/pages/payroll/PayrollPage.tsx` | `PayrollPage:67` |
| `frontend/src/pages/people/DirectoryPage.tsx` | `DirectoryPage:162` |
| `frontend/src/pages/people/PeopleFilterDrawer.tsx` | `PeopleFilters:42`, `EMPTY_PEOPLE_FILTERS:51`, `countActiveFilters:64`, `PeopleFilterDrawer:83` |
| `frontend/src/pages/people/ProfilePage.tsx` | `ProfilePage:107` |
| `frontend/src/pages/policies/PoliciesPage.tsx` | `PoliciesPage:50` |
| `frontend/src/pages/recruitment/RecruitmentPage.tsx` | `RecruitmentPage:36` |
| `frontend/src/pages/reports/MusterPage.tsx` | `MusterPage:146` |
| `frontend/src/pages/reports/ReportsPage.tsx` | `ReportsPage:64` |
| `frontend/src/pages/reports/SupportingReportPage.tsx` | `SupportingReportPage:67` |
| `frontend/src/pages/reports/SupportingReports.tsx` | `R2SwipesPage:133`, `R3RegularizationsPage:272`, `R4ExceptionsPage:375`, `R5OtPage:507`, `R6AbsencePage:593`, `R24BoardingPage:672`, `R27HeadcountPage:760` |
| `frontend/src/pages/team/OtDecisionsPage.tsx` | `OtDecisionsPage:69` |
| `frontend/src/pages/team/TeamPage.tsx` | `TeamPage:198` |
| `frontend/src/pages/travel/TravelPage.tsx` | `TravelPage:71` |
| `frontend/src/pages/workplace/AssetsPage.tsx` | `AssetsPage:84` |
| `frontend/src/pages/workplace/EngagementPage.tsx` | `EngagementPage:45` |
| `frontend/src/pages/workplace/HelpdeskPage.tsx` | `HelpdeskPage:107` |

See `frontend/src/app/router.tsx` for actual route mapping, `frontend/src/lib/api.ts` for HTTP helpers and the generated client artifacts present in the checkout. A listed page can deliberately render a pending backend state; that is honest UI coverage, not a completed business flow.

## Verification boundary

The deeper pass ran full frontend verify successfully (233 tests) and backend verify with application/test DB URLs explicitly empty. Backend typecheck/lint/knip/dependency-cruiser and 88 tests passed, 164 DB tests skipped, and overall coverage failed the required floor; full backend verify is red. Backend build passed separately. See pack10 and `verification-2026-10-09.json`. No live DB, migration rehearsal, real payroll engine golden suite, browser UAT or production connector was certified. The expanded `deep-code-index.json` covers all338 visible backend/frontend project files plus4 deployment/CI files, with function/DB-operation/HTTP/control locators. Existing application sources were unchanged. Historical deployed findings remain dated until revalidated; credited source fixes must not be presented as still missing.
