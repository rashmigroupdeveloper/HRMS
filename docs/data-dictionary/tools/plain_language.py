"""Reader explanations for the existing field dictionary; no application behavior."""
import re

# Describes the work represented by each table, rather than repeating its SQL name.
TABLES = {
'ast.assets':'Lists company property such as laptops, phones and vehicles.',
'ast.assignments':'Records who has been given each company asset and whether it has been returned.',
'ast.maintenance':'Keeps the service, repair and damage history of company assets.',
'att.absence_cases':'Tracks extended unexplained absence and the follow-up needed from HR.',
'att.coverage_targets':'Records how many people are needed for each staffing group and shift.',
'att.day_records':'Keeps the processed attendance result for one employee on one working date.',
'att.device_watermarks':'Records how far each attendance device has confirmed its data is complete.',
'att.devices':'Lists biometric attendance devices and their operating details.',
'att.employee_shifts':'Records which shift arrangement applies to an employee over time.',
'att.holidays':'Lists holidays and the employee groups or places to which they apply.',
'att.ingest_watermarks':'Records progress when receiving attendance data from an external source.',
'att.kent_unknown_faces':'Keeps biometric events that could not be matched to an employee for investigation.',
'att.kent_webhook_batches':'Records groups of attendance events received from Kent and their processing results.',
'att.leave_blackouts':'Lists dates on which leave restrictions apply.',
'att.manager_month_approvals':'Keeps managers’ monthly attendance approvals and later withdrawals of those approvals.',
'att.month_locks':'Records when a company’s attendance period is frozen for payroll.',
'att.overtime_entries':'Tracks detected overtime, the manager’s decision and whether it is paid or converted to leave.',
'att.quarantined_swipes':'Separates questionable attendance punches for investigation.',
'att.recompute_queue':'Lists attendance dates waiting to be calculated again after a relevant change.',
'att.regularizations':'Records requests to correct attendance or record approved on-duty time.',
'att.roster_publications':'Records when a work schedule is published.',
'att.roster_revisions':'Keeps the history of work-schedule changes.',
'att.rosters':'Records an employee’s planned shift or weekly off for a date.',
'att.shift_patterns':'Defines repeating arrangements of work shifts and days off.',
'att.shift_swaps':'Tracks requests to exchange scheduled shifts.',
'att.shifts':'Defines working times, breaks and attendance rules for each shift.',
'att.swipe_events':'Keeps original attendance punches received from devices or other approved sources.',
'cmp.calendar_items':'Tracks compliance obligations and their due dates.',
'cmp.filing_evidence':'Links compliance filings to the evidence of submission.',
'cmp.registrations':'Keeps the company’s statutory registrations and licence details.',
'core.ats_acceptance_receipts':'Keeps evidence that an offer was accepted in the recruitment system; this does not itself create an employee.',
'core.audit_log':'Keeps the history of important actions so authorized reviewers can trace who did what.',
'core.bulk_jobs':'Tracks file imports and exports, their progress and errors.',
'core.clearances':'Tracks departmental clearances required when an employee leaves.',
'core.companies':'Lists the separate legal companies covered by HRMS.',
'core.cost_centers':'Lists the accounting groups to which employee costs are assigned.',
'core.department_heads':'Records which people head each department.',
'core.departments':'Lists departments used to organize employees.',
'core.designations':'Lists employee job titles.',
'core.documents':'Lists stored employee or candidate documents and their ownership and verification details.',
'core.employee_addresses':'Keeps employees’ address details.',
'core.employee_certifications':'Keeps employees’ professional qualifications and certificates.',
'core.employee_education':'Keeps employees’ education history.',
'core.employee_experience':'Keeps employees’ previous employment experience.',
'core.employee_family':'Keeps employees’ family and dependant details.',
'core.employee_history':'Keeps a history of changes to employee information.',
'core.employee_nominations':'Records people nominated to receive specified employee benefits.',
'core.employee_statutory_profile':'Keeps employee information needed for statutory declarations and benefits.',
'core.employees':'Keeps the main employment record for each person who has actually joined.',
'core.grades':'Lists employee grades used for employment and policy classification.',
'core.letter_templates':'Keeps reusable wording and layouts for HR letters.',
'core.letters':'Records HR letters issued to employees.',
'core.locations':'Lists work locations.',
'core.mis_codes':'Lists management-reporting codes used to classify employees or organizational costs.',
'core.nomination_declarations':'Keeps employees’ declarations supporting their benefit nominations.',
'core.onboarding_candidates':'Keeps accepted-offer candidates separate from employees until actual joining is confirmed.',
'core.onboarding_tasks':'Tracks joining tasks assigned to HR, IT, Admin and Payroll.',
'core.org_units':'Lists organizational units and their reporting hierarchy.',
'core.password_reset_tokens':'Keeps temporary password-reset proof without storing a usable reset link in plain text.',
'core.permissions':'Lists the individual actions that access administrators can allow.',
'core.plants':'Lists plants within the group.',
'core.policies':'Keeps published company policies and their versions.',
'core.policy_acknowledgments':'Records employees’ acknowledgment of published policies.',
'core.probation_reviews':'Tracks probation review dates, recommendations and decisions.',
'core.profile_change_requests':'Tracks employee requests to change personal information.',
'core.reporting_tree':'Connects employees to their management hierarchy for authorized team views.',
'core.role_permissions':'Records which actions are allowed for each access role.',
'core.roles':'Lists access roles used to group permitted actions.',
'core.separations':'Tracks resignations and other exits, including approved last working dates.',
'core.settings':'Keeps configurable system and policy choices.',
'core.transfers':'Tracks proposed and approved changes in employee placement or employment assignment.',
'core.user_roles':'Records the access roles assigned to each login account.',
'core.users':'Keeps login accounts; a login account and an employee record are different things.',
'doc.types':'Lists recognized document categories and their collection and retention rules.',
'eng.announcements':'Keeps announcements and the audiences that should receive them.',
'eng.poll_responses':'Records answers to employee polls.',
'eng.polls':'Defines employee polls and their choices.',
'eng.survey_responses':'Keeps submitted survey answers.',
'eng.surveys':'Defines employee surveys and their questions.',
'hd.categories':'Defines helpdesk categories and their handling rules.',
'hd.ticket_messages':'Keeps the conversation and attachments within a helpdesk request.',
'hd.tickets':'Tracks employee helpdesk requests from opening to closure.',
'ird.grievances':'Keeps confidential employee grievance records.',
'ird.ic_members':'Lists members of the Internal Committee that handles POSH complaints.',
'ird.posh_case_access_log':'Records who accessed a confidential POSH case.',
'ird.posh_case_assignments':'Records which authorized people are assigned to a POSH case.',
'ird.posh_cases':'Keeps confidential complaints under the prevention of sexual harassment process.',
'ird.whistleblower_reports':'Keeps confidential reports of suspected wrongdoing.',
'lv.applications':'Tracks employee leave requests and approval decisions.',
'lv.leave_types':'Defines leave categories and their entitlement rules.',
'lv.ledger':'Keeps individual additions and deductions from leave entitlement; balances are worked out from these movements.',
'lv.restricted_holidays':'Lists optional holidays employees may choose under policy.',
'lv.rh_selections':'Records which optional holidays an employee has selected.',
'med.access_log':'Records access to sensitive employee medical information.',
'med.questionnaires':'Keeps submitted medical questionnaires and their consent information.',
'pay.arrears':'Records salary adjustments relating to an earlier payroll period.',
'pay.bank_batches':'Groups salary payments into bank-payment files.',
'pay.budget_categories':'Breaks a reimbursement budget into expense categories and their allowances.',
'pay.budgets':'Tracks proposed and approved expense budgets.',
'pay.claim_bills':'Keeps bills submitted to support reimbursement claims.',
'pay.claim_entitlements':'Records an employee’s configured reimbursement entitlement.',
'pay.claim_lines':'Keeps the individual expenses within a reimbursement claim.',
'pay.claim_reservations':'Tracks amounts reserved against or released back to expense budgets.',
'pay.claim_types':'Defines reimbursement categories and their supporting-document and tax policies.',
'pay.claims':'Tracks reimbursement requests, review decisions and payment links.',
'pay.employee_salaries':'Keeps salary arrangements and the dates on which each version applies.',
'pay.fnf_settlements':'Keeps the final calculation of amounts payable and recoverable when an employee leaves.',
'pay.gl_accounts':'Maps payroll components to Finance’s accounting codes.',
'pay.inputs':'Keeps approved monthly salary additions or deductions outside the normal salary arrangement.',
'pay.investment_declarations':'Keeps employees’ tax-saving declarations and amounts accepted after review.',
'pay.it_slabs':'Keeps configured income-tax bands and related calculation parameters.',
'pay.loan_postings':'Keeps individual loan repayment movements and their principal and interest parts.',
'pay.loans':'Tracks employee loans or salary advances and their repayment arrangements.',
'pay.payroll_item_lines':'Explains each earning, deduction or employer contribution within an employee’s salary calculation.',
'pay.payroll_items':'Keeps one employee’s result within a payroll run.',
'pay.payroll_runs':'Tracks a company’s payroll calculation and approval process for a period.',
'pay.pt_slabs':'Keeps configured professional-tax bands.',
'pay.recovery_carry_forwards':'Tracks deductions that must be recovered through a later payroll result.',
'pay.reimbursement_batch_items':'Lists the approved claims included in a reimbursement payment batch.',
'pay.reimbursement_batches':'Groups reimbursement payments separately from salary payment batches.',
'pay.salary_components':'Defines pay heads such as earnings, deductions and employer contributions.',
'pay.salary_holds':'Records instructions to hold salary calculation or salary payment.',
'pay.salary_structures':'Defines reusable arrangements of salary components.',
'pay.statutory_rates':'Keeps dated statutory calculation parameters and their recorded sources.',
'pay.tds_challans':'Keeps payment references for income tax deducted from salaries and remitted to government.',
'prv.breach_register':'Records incidents involving possible loss or misuse of personal information.',
'prv.consent_events':'Keeps the history of changes to a person’s recorded consent.',
'prv.consents':'Records whether a person has given consent for a stated use of information.',
'prv.declaration_texts':'Keeps the exact versions of declaration wording.',
'prv.declarations':'Records which declaration wording a person accepted and how they signed.',
'prv.legal_holds':'Records instructions to preserve information that would otherwise be eligible for deletion.',
'prv.notice_acks':'Records acknowledgments of privacy notices.',
'prv.notices':'Keeps published privacy notices and their versions.',
'prv.processing_register':'Describes what personal information is used, for what purpose and for how long.',
'prv.processors':'Lists outside organizations that process personal information for the company.',
'prv.purge_log':'Keeps the record of completed personal-data deletion operations.',
'prv.purge_proposals':'Tracks proposed data deletions for review before execution.',
'prv.retention_rules':'Defines how long each category of personal information should be kept.',
'prv.rights_requests':'Tracks requests by people to exercise their privacy rights.',
'public.pgmigrations':'Records database maintenance updates applied by the technical migration tool.',
'reporting.kpi_daily':'Keeps prepared daily figures for management dashboards.',
'reporting.muster_month':'Keeps the prepared monthly employee-attendance report.',
'sec.access_events':'Records access to protected employee information.',
'sec.app_links':'Connects an HRMS login account to a verified account in another approved application.',
'sec.mfa_enrolments':'Retains extra sign-in verification setup for compatibility; this feature is outside the current approved scope.',
'sec.mfa_recovery_codes':'Retains recovery-code information for extra sign-in verification; this feature is outside the current approved scope.',
'sec.password_history':'Keeps password fingerprints needed to check password history without exposing previous passwords.',
'sec.sessions':'Tracks individual sign-ins, their expiry and whether access has been ended.',
'sec.sso_grants':'Keeps short-lived proof used to sign into an approved linked application.',
 'te.advances':'Tracks money requested or provided before business travel.',
 'te.budget_reservations':'Tracks amounts reserved against or released back to travel budgets.',
 'te.budgets':'Defines travel entitlement limits by grade and travel category.',
 'te.claim_items':'Keeps individual expenses submitted in a travel claim.',
 'te.claims':'Tracks travel reimbursement claims and adjustment of advances.',
 'te.settlements':'Records the final travel amount payable to or recoverable from an employee.',
 'te.trip_itineraries':'Keeps travel segments, bookings and accommodation arrangements.',
 'te.trips':'Tracks business-trip requests, plans, budgets and approvals.',
 'te.wallet_transactions':'Keeps individual travel-wallet movements so balances can be checked.',
 'te.wallets':'Keeps the employee’s travel-wallet record and stored balance.',
'wf.definitions':'Defines the approval steps to follow for each request category.',
'wf.delegations':'Records who may handle another person’s approvals while they are away.',
'wf.event_subscriptions':'Defines who should be notified when specified business events happen.',
'wf.notifications':'Tracks messages waiting to be sent and their delivery results.',
'wf.request_steps':'Keeps the actual approvers, decisions and notification times for an individual request.',
'wf.requests':'Tracks an individual request through its approval process.',
}

REPLACE = {
'FK':'link to another record', 'JSONB':'a set of related details', 'JSON':'a set of related details',
'NUMERIC':'an exact number', 'NULL':'not recorded', 'boolean':'yes/no choice',
'provenance':'where the information came from', 'discriminator':'choice that tells the system which kind this is',
'canonical':'main', 'idempotency':'duplicate-prevention', 'idempotent':'safe to repeat without making duplicates',
'append-only':'kept as history, with new entries added rather than old entries overwritten',
'immutable':'protected against later changes', 'snapshot':'copy saved at that point in time',
'ledger':'history of additions and deductions', 'accrual':'earned entitlement',
'proration':'adjustment for the payable part of the period', 'prorated':'adjusted for the payable part of the period',
'prorate':'adjust for the payable part of the period', 'metadata':'descriptive information',
'payload':'saved request or message details', 'digest':'digital fingerprint',
'SHA-256':'a digital fingerprint used to check that information matches',
'SHA256':'a digital fingerprint used to check that information matches',
'catalog':'list of available choices', 'registry':'register', 'retention':'how long information is kept',
'lifecycle':'progress from creation to closure', 'instalment':'repayment instalment',
'CTC':'cost to company (the total employment cost)', 'LOP':'loss of pay',
'F&F':'full and final settlement when an employee leaves',
'EPF':'Employees’ Provident Fund', 'EPS':'Employees’ Pension Scheme',
'ESIC':'Employees’ State Insurance', 'UAN':'Universal Account Number for provident fund',
'TDS':'income tax deducted from salary', 'PF':'provident fund',
'AR':'attendance correction request', 'OD':'approved on-duty time',
'OT':'overtime', 'DOJ':'date of joining', 'DOL':'date of leaving',
'LWD':'last working day', 'SLA':'target time for completing the action',
'RBAC':'access based on assigned roles', 'SSO':'sign-in shared with an approved application',
'PKCE':'a security check linking the sign-in request to the same requesting application',
}

SPECIAL = {
'core.employees.id':('A number the system uses to recognize this employee internally. It is separate from the employee code HR normally quotes.','Keeps this person’s attendance, leave and salary connected to the same employee.','An attendance entry linked to employee 123 belongs to that employee, even if the display name changes.'),
'core.employees.ecode':('The employee code used by HR and employees to identify a person.','Helps staff find the right employee and match records across approved systems.','HR searches using the employee’s assigned company code rather than relying on the name alone.'),
'core.employees.doj':('The date the employee actually joined.','Establishes when employment starts for the processes that use joining date.','A joining date of 11 Nov 2026 means employment starts on that date.'),
'core.employees.dol':('The recorded date the employee left employment.','Keeps exit-related records and employment dates consistent.','Once an exit is completed, the leaving date tells HR when employment ended.'),
'att.day_records.penalty_evaluation':('The saved details of any late-arrival or early-leaving rule that matched that day.','Explains a separate attendance finding without changing the actual presence or absence result.','A person can remain marked present while a separate late-arrival finding is shown. This field alone does not reduce salary.'),
'att.day_records.weekoff_paid':('Whether this weekly off qualifies as paid under the applicable attendance rules.','Lets payroll distinguish a paid weekly off from one that counts as loss of pay.','Two weekly-off dates may have different payment treatment because the qualifying attendance differs.'),
'att.month_locks.period_until':('The first instant after the frozen attendance period. It is not included in that period.','Makes the end of one attendance period and the start of the next unambiguous.','For a period ending just before 01 Dec 2026, 01 Dec belongs to the next period.'),
'pay.claims.reimbursement_batch_id':('The group of reimbursement payments in which this approved claim is being paid.','Connects an expense repayment to its own payment record, separately from salary.','An approved expense claim appears in a reimbursement payment batch rather than becoming a salary item.'),
'pay.inputs.claim_id':('An older link showing which reimbursement claim produced a salary adjustment.','Allows old combined salary-and-claim payments to be checked later; new reimbursements use separate payments.','Finance checks an old salary record against the claim it originally paid. This link is not an instruction to pay it again.'),
'pay.claims.paid_in_run_id':('The older salary run through which this claim was paid, where such a historical link exists.','Preserves the explanation of historical combined payments.','An old claim can be traced to its original salary payment without creating another payment.'),
'pay.claims.paid_in_batch_id':('The older salary bank-payment batch linked to this claim, where recorded.','Supports checking historical combined payments.','Finance compares an old claim with the bank batch that paid it.'),
'pay.payroll_item_lines.calc_note':('The written explanation of how one payslip amount was worked out.','Helps an employee or payroll reviewer understand the amount rather than seeing only a number.','A line explains that an allowance was adjusted because only part of the month was payable.'),
'pay.payroll_items.net_pay':('The salary amount left for the employee after deductions.','Shows the result of the salary calculation before any separate payment or hold checks.','Illustration: ₹30,000 earnings minus ₹2,000 deductions leaves ₹28,000 net pay.'),
'pay.payroll_items.payable_days':('The number of days counted for payment in this payroll calculation.','Supplies the day count used when salary is adjusted for attendance.','A period can have 30 calendar days while fewer days qualify for salary.'),
'pay.employee_salaries.annual_ctc':('The employee’s annual cost to the company under this salary arrangement.','Records the annual employment-cost basis for that salary version.','An annual cost-to-company figure is not the same as the employee’s monthly bank payment.'),
'wf.request_steps.notified_at':('The time at which this approver was recorded as notified about the request.','Provides evidence of the notification step instead of assuming the approver knew about it.','HR can check whether and when an approval notification was recorded; the time does not prove the person read it.'),
'wf.definitions.steps':('The planned order of approvals and the rules for choosing each approver.','Tells the approval process whom to approach and what to do if a step is delayed.','A configured process can ask the reporting manager first and HR next.'),
'core.onboarding_candidates.employee_id':('The employee record created after this candidate’s actual joining is confirmed, if conversion has occurred.','Links the earlier candidate information to the person’s employment record without treating every accepted offer as a joining.','A candidate who accepts an offer but never joins does not receive a permanent employee record through this link.'),
'pay.salary_components.part_of_pf_wages':('Whether this pay head is included in the wage amount used for provident-fund calculation.','Lets the configured salary calculation select its provident-fund wage base.','A pay head included in provident-fund wages can affect that calculation; the payable rate comes from separate rules.'),
'pay.salary_components.prorate_on_lop':('Whether this pay head is reduced when part of the period is unpaid.','Tells payroll which amounts should follow the payable-day adjustment.','A monthly allowance marked this way is adjusted when some days count as loss of pay.'),
}

def simplify(text):
    text=re.sub(r'FOREIGN KEY.*?(?=;|$)', 'the related record',text)
    text=re.sub(r'\b(?:docs|backend|outputs)/\S+', 'the supporting technical reference',text)
    for word, phrase in REPLACE.items():
        text=re.sub(r'\b'+re.escape(word)+r'\b',phrase,text,flags=re.I if word.islower() else 0)
    text=re.sub(r'`([^`]+)`',r'\1',text)
    return text.strip().rstrip('.')+'.'


def explain(c, meaning, values):
    table=c['table_name']; name=c['column_name']; key=table+'.'+name
    if key in SPECIAL:
        plain,why,example=SPECIAL[key]
    else:
        plain=simplify(meaning)
        if name=='id':
            plain='The unique number the system gives this particular record. It is used to tell it apart from every other record in the same register.'
            why='Allows the correct record to be found and linked without relying on a name or description.'
            example='If two records have the same display name, their internal numbers still tell them apart.'
        elif any(k['kind']=='f' for k in c['constraints']) or name.endswith('_id'):
            target=next((re.search(r'REFERENCES ([\w.]+)',k['definition']).group(1) for k in c['constraints'] if k['kind']=='f' and re.search(r'REFERENCES ([\w.]+)',k['definition'])),None)
            subject={'employee_id':'the employee','company_id':'the legal company','user_id':'the login account','candidate_id':'the candidate','created_by':'the person who created the record','updated_by':'the person who last changed the record'}.get(name,name.removesuffix('_id').replace('_',' '))
            if meaning.startswith('Reference linking'):
                plain='Identifies '+subject+' connected to this record.'
            why='Keeps this record connected to the correct '+subject.removeprefix('the ')+', so related details can be checked together.'
            example='This record points to an existing entry'+(' in '+target.split('.')[-1].replace('_',' ') if target else '')+' instead of copying all of that entry’s details.'
        elif name in ('created_at','updated_at') or name.endswith('_at'):
            why='Helps staff reconstruct when this step happened and follow up in the right order.'
            example='A saved time might show 11 Nov 2026, 10:30 AM IST. A missing time means that event has not been recorded.'
        elif c['data_type']=='boolean':
            why='Lets the relevant process distinguish “yes” from “no” for this specific rule or condition.'
            example='Yes means the condition described here is true; No means it is false.'
        elif name in ('status','stage','outcome','settlement_status','payment_status','visa_status'):
            plain=plain.replace('Current lifecycle state','Current progress').replace('lifecycle state','progress')
            why='Shows what has already happened and what may still need follow-up. An approval status and a payment status can represent different steps.'
            example=('“'+values[0]['value']+'” means '+simplify(values[0]['meaning']) if values else 'Staff read the saved stage to see where this particular record has reached.')
        elif name.endswith('_paise'):
            why='Keeps this amount in the smallest rupee unit so calculations can preserve paise accurately.'
            example='10,050 paise represents ₹100.50. This illustrates the unit, not a policy limit.'
        elif c['data_type']=='date':
            why='Places the information on the correct calendar date or applicable period.'
            example='11 Nov 2026 is a calendar date. Any start/end-date rules still apply.'
        elif c['data_type']=='jsonb':
            why='Keeps related details together when a single short answer would not describe the event or result.'
            example='Read this as a small form or saved set of answers. The exact questions/details depend on the process described above.'
        elif re.search(r'amount|gross|net_pay|ctc|wages|principal|allowance|cost|deduction|emi',name) and 'numeric' in c['data_type']:
            why='Keeps the specific money figure described here available for calculation, review or payment checking.'
            example='₹100.50 illustrates how a rupee amount is read; it is not an entitlement, rate or required payment.'
        elif re.search(r'hash|secret|token|nonce|challenge|password',name):
            why='Supports identity checks or information-integrity checks without exposing a reusable secret to ordinary readers.'
            example='The actual security value is deliberately omitted. A fingerprint is compared by the system rather than read as a password.'
        elif values:
            why='Gives staff and the system a consistent choice for the classification described here.'
            example='“'+values[0]['value']+'” means '+simplify(values[0]['meaning'])
        elif re.search(r'reason|note|comment|description|explanation|summary|body',name):
            why='Preserves the explanation so another person can understand the record later.'
            example='The saved wording answers the question described above; it should explain the specific case rather than just say “done”.'
        elif re.search(r'count|attempts|days|hours|minutes|months|nights|records|rows',name):
            why='Records the quantity or duration described here so it can be checked using the correct unit.'
            example='A value of 2 means two of the units named in this field; days, hours and minutes must not be treated as interchangeable.'
        else:
            why='Keeps this specific detail with the record so staff can identify, explain or check it in context.'
            example='Use the meaning above when reading the saved value; it describes this field’s particular detail, not the whole employee or request.'
    return {'plain_explanation':plain,'why_it_matters':why,'example':example,'friendly_name':name.replace('_',' ').capitalize()}
