# Additional greytHR employee fields — 07 Oct 2026

Authenticated, read-only field-metadata reconnaissance of rashmi-group.greythr.com requested by the account holder. This supplements doc 09; it does not amend approved requirements or authorize schema changes. CORE-08/12; docs 03, 09 and 11; P0-T02 recon evidence. Business records were not edited or imported. Authentication used the supplied token against greytHR's own documented-in-client session flow; no token, cookie, challenge, credential or personal field values are included in this artifact.

Six metadata sections returned HTTP 200. **164 field-definition appearances**, representing **143 unique technical field names**, were captured. These include computed/display fields, repeated passport/visa definitions and legacy labels, so they are not a count of distinct physical database columns. The source is greytHR's form/field configuration; it does not expose greytHR's physical SQL schema.

The authorized menu also returned employee, payroll and workforce-management page names. A menu entry alone does not prove access to that page, populated business data, or permission to export everyone. No role or administrator status was inferred from the menu.

## Confirmed additional fields and HRMS comparison

| Group | Fields exposed by greytHR metadata | Existing HRMS representation | Assessment |
|---|---|---|---|
| Personal identity | Nationality, place of birth, residential status, father's name, marriage date, spouse name, international-employee flag | employees has DOB, gender, marital_status, names and blood_group; these additional fields are not explicit live columns | Newly evidenced migration/scope questions; some spouse/father information may belong in family records rather than duplicate employee text |
| Contact/address | Address type, address lines 1–3, city, district, state, country, PIN, secondary phones, extension | employees has present_address/permanent_address as text, mobile/email and emergency contact | Partial coverage; structured addresses are not equivalent to two free-text strings |
| Banking | Branch, account type, name as per bank, DD payable at, payment type | employees has bank_name, bank_account, bank_ifsc and payment_mode | Core banking is represented; branch/type/name matching are additional fields |
| PF membership/KYC | PF joining date, KYC type/status/link date, previous PF number, existing-member flag, higher-wage EPS and EPF contribution flags | employees has PF applicability, PF number and UAN | Membership history/KYC and per-employee contribution elections are not explicitly modeled; they must not be confused with centrally configured statutory rates |
| Passport | Number, passport type, given/middle/surname, country, issue date/city/place, expiry date, family-member link, custody information | Generic documents table exists; no dedicated passport data model found | File storage alone cannot support structured expiry queries or employee/dependent ownership |
| Visa | Number, type/name, country, issue date, validity, family-member link | Generic documents table exists; no dedicated visa data model found | Additional structured record/expiry relationship to scope |
| Family | DOB, gender, blood group, nationality and dependent passport/visa references | employee_family has name, relation, DOB, Aadhaar and nominee/dependency flags | Partial coverage; gender/nationality/blood_group are missing live columns. Age can be derived from DOB |
| Nominations | Nomination purpose, share percentage, guardian name/relationship and guardian contact information; page configuration distinguishes EPF, EPS, ESI and Gratuity | employee_family has is_nominee and one nominee_share_pct | A single share percentage does not express separate allocations by scheme or guardianship |
| Insurance | Policy number, provider, type, sum insured, issue/expiry dates and family-member association | No dedicated live insurance relation found | Newly confirmed relational gap; generic documents do not record coverage and policy relationships |
| Access cards | Card number, from/to dates and validity | employees.access_card_no is one current text value | Current card is covered; effective dates and card history are not explicitly modeled |
| Assets | Model, original/current value, issue/return dates and remarks | ast.assets and ast.assignments cover identity, serial number, employee custody, assignment/return timestamps and notes | Model/value fields are missing live columns; existing relational custody design is useful |
| Education | Qualification, institute, grade, highest-qualification flag, study from/to years | docs 03 defines employee_education, but it is absent from the live schema | Existing specification implementation gap; additional grade/highest/from-year fields need a requirement decision |
| Previous employment | Company, duration and designation | docs 03 defines employee_prev_employment, but it is absent from the live schema | Existing specification implementation gap; history should be employee-linked rows, not columns repeated on employees |

## Collection choices to review, rather than copy automatically

The metadata exposes religion, caste, disability flag, height, weight, identification mark and hobby fields. Their presence is not a requirement to collect them. Purpose, applicability and access need an explicit project decision before adding sensitive or unnecessary attributes. Legacy labels have been preserved only in the technical inventory for migration matching; they are not proposed product wording.

The form metadata reports some fields as mandatory, including hobby/caste and various contact fields. Such flags are source configuration, **not proof that every employee has populated them** or that the current UI always enforces them. Photo and blood-group definitions are present but marked disabled in the inspected personal field list.

## How these additional records would connect

These are proposed mapping shapes for review, not implemented tables or approved features:

- Structured addresses, education and prior-employment rows would belong to employee_id; one employee can have several historical rows.
- Passport/visa records would need an unambiguous employee or family-member owner, plus document references and issue/expiry dates.
- Insurance policies and covered people should be distinguished: one policy can cover the employee and several dependents.
- Nomination allocations need employee + scheme + nominee + share, with guardian details where applicable. The current single family share field loses the scheme dimension.
- Access-card assignments need employee + card + effective dates; raw historical swipes must remain traceable after the current card changes.
- PF membership attributes belong to employee membership data; policy/rate numbers continue to belong to versioned settings/statutory configuration.

## Endpoints verified

| Metadata endpoint | Status | Field-definition appearances |
|---|---:|---:|
| /v3/api/empinfo/personal/fields | 200 | 46 |
| /v3/api/empinfo/accounts/fields | 200 | 48 |
| /v3/api/empinfo/family/fields | 200 | 42 |
| /v3/api/empinfo/assets/fields | 200 | 17 |
| /v3/api/empinfo/insurance/fields | 200 | 8 |
| /core-hr/v1/empandjob/fields | 200 | 3 |

The navigation/page configuration endpoints /resto/v1/menu, /v3/api/empinfo/nav-pages and /v3/api/empinfo/pages also returned HTTP 200. Directory metadata confirmed Joining Date, Date Of Birth, Blood Group, Designation and Work Location. These were already represented in HRMS. The attempted employee-profile/profile endpoint and /v3/core-hr variants returned 404; no employee row data was obtained from them. The core-hr employment field metadata was successfully read without the /v3 prefix.

## Full sanitized field inventory

Every captured definition is listed below. No values/defaults or employee records are included. Display titles can be aliases rather than human-friendly labels. Repeated definitions in multiple sections are kept to preserve source placement.

### Personal

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| basicInformation$emp1$employeephoto | employeephoto | STRING | No | Yes |
| basicInformation$emp1$name | Name | STRING | Yes | Yes |
| basicInformation$emp1$employeeno | EmployeeNo | STRING | Yes | Yes |
| basicInformation$emp1$email | Email | STRING | Yes | Yes |
| currentTransitions$extEmpInfo$c_location | c_location | STRING | Yes | Yes |
| basicInformation$emp1$mobile | Mobile | STRING | Yes | Yes |
| basicInformation$emp1$bloodgroup | bloodgroup | NUMBER | No | No |
| basicInformation$emp1$dob | dob | DATE | Yes | No |
| basicInformation$emp1$nationality | Nationality | NUMBER | Yes | No |
| basicInformation$emp1$maritalstatus | maritalstatus | NUMBER | Yes | No |
| basicInformation$emp1$marriagedate | MarriageDate | DATE | Yes | No |
| basicInformation$emp1$spousename | spousename | STRING | Yes | No |
| basicInformation$emp1$birthplace | birthplace | STRING | Yes | No |
| basicInformation$emp1$residentialStatus | ResidentialStatus | NUMBER | Yes | No |
| basicInformation$emp1$fathername | FatherName | STRING | Yes | No |
| basicInformation$emp1$religion | religion | NUMBER | Yes | No |
| basicInformation$emp1$isphyschallanged | isphyschallanged | BOOLEAN | Yes | No |
| basicInformation$emp1$isinternationalemp | isinternationalemp | BOOLEAN | Yes | No |
| basicInformation$employeedetails$height | height | STRING | Yes | No |
| basicInformation$employeedetails$weight | weight | STRING | Yes | No |
| basicInformation$employeedetails$identificationmark | identificationmark | STRING | Yes | No |
| nocategory$emp1$hobby | hobby | STRING | Yes | Yes |
| nocategory$emp1$caste | caste | STRING | Yes | Yes |
| allAddress$addr$name | addrname | STRING | Yes | No |
| allAddress$addr$email | email | STRING | Yes | No |
| allAddress$addr$phone1 | phone1 | STRING | Yes | No |
| allAddress$addr$phone2 | phone2 | STRING | Yes | Yes |
| allAddress$addr$mobile | mobile | STRING | Yes | Yes |
| allAddress$addr$extnno | extnno | STRING | Yes | Yes |
| allAddress$addr$fax | fax | STRING | Yes | Yes |
| allAddress$addr$relation | relation | NUMBER | Yes | Yes |
| allAddress$addr$addr_type | addr_type | STRING | Yes | Yes |
| allAddress$addr$address1 | address1 | STRING | Yes | No |
| allAddress$addr$address2 | address2 | STRING | Yes | No |
| allAddress$addr$address3 | address3 | STRING | Yes | No |
| allAddress$addr$city | city | STRING | Yes | No |
| allAddress$addr$district | district | STRING | Yes | Yes |
| allAddress$addr$state | state | STRING | Yes | Yes |
| allAddress$addr$country | country | STRING | Yes | Yes |
| allAddress$addr$pin | pin | STRING | Yes | No |
| empQualification$empQualification$qualdescription | qualdescription | NUMBER | Yes | No |
| empQualification$empQualification$institute | institute | STRING | Yes | No |
| empQualification$empQualification$grade | grade | STRING | Yes | Yes |
| empQualification$empQualification$ishighestqualification | ishighestqualification | BOOLEAN | Yes | No |
| empQualification$empQualification$qual_year | qual_year | NUMBER | Yes | No |
| empQualification$empQualification$qual_year_to | qual_year_to | NUMBER | Yes | No |

### Accounts and statutory

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| bankDetails$empBank$bankname | bankname | NUMBER | Yes | Yes |
| bankDetails$empBank$bankaccno | bankaccno | STRING | Yes | Yes |
| bankDetails$empBank$bankbranch | bankbranch | NUMBER | Yes | Yes |
| bankDetails$empBank$ifsccode | ifsccode | STRING | Yes | Yes |
| bankDetails$empBank$bankacctype | bankacctype | NUMBER | Yes | Yes |
| bankDetails$empBank$paytype | paytype | NUMBER | Yes | Yes |
| bankDetails$empBank$ddpayableat | ddpayableat | STRING | Yes | Yes |
| bankDetails$empBank$nameAsPerBank | NamePerBank | STRING | Yes | Yes |
| basicInformation$employeedetails$iflwfeligible | iflwfeligible | BOOLEAN | Yes | Yes |
| basicInformation$empPF$pfnumber | pfnumber | STRING | Yes | Yes |
| basicInformation$empPF$ifpfeligible | ifpfeligible | BOOLEAN | Yes | Yes |
| basicInformation$empPF$uan | uan | STRING | Yes | Yes |
| basicInformation$empPF$pfjoindate | pfjoindate | DATE | Yes | Yes |
| empIdentities$tblEmpIdentities$idtype | idtype | STRING | Yes | No |
| basicInformation$empPF$ispf_kycid | ispf_kycid | BOOLEAN | Yes | Yes |
| basicInformation$empPF$ifpf_kycid | ifpf_kycid | BOOLEAN | Yes | Yes |
| basicInformation$empPF$pf_kyclinkeddate | pf_kyclinkeddate | DATE | Yes | Yes |
| basicInformation$empPF$fpfnumber | fpfnumber | BOOLEAN | Yes | Yes |
| basicInformation$empPF$ifconthigherwageseps | ifconthigherwageseps | BOOLEAN | Yes | Yes |
| basicInformation$empPF$ifconthigherwagesepf | ifconthigherwagesepf | BOOLEAN | Yes | Yes |
| basicInformation$empPF$pfexistingmember | pfexistingmember | BOOLEAN | Yes | Yes |
| basicInformation$empPF$ifconthigherwagesepsdesc | ifconthigherwagesepsdesc | BOOLEAN | Yes | Yes |
| basicInformation$empPF$ifconthigherwagesepfdesc | ifconthigherwagesepfdesc | BOOLEAN | Yes | Yes |
| basicInformation$empPF$pfexistingmemberdesc | pfexistingmemberdesc | BOOLEAN | Yes | Yes |
| custom$emppassport$passportno | Passport | NUMBER | Yes | Yes |
| custom$emppassport$expirydate | Expirydate | DATE | Yes | Yes |
| custom$emppassport$familyempmber | Family Member | STRING | Yes | Yes |
| custom$emppassport$passporttype | Passport Type | STRING | Yes | Yes |
| custom$emppassport$givenname | First name | STRING | Yes | Yes |
| custom$emppassport$middlename | Middle Name | STRING | Yes | Yes |
| custom$emppassport$surname | Surname | STRING | Yes | Yes |
| custom$emppassport$address | Address | STRING | Yes | Yes |
| custom$empPassport$currentlywith | Currently With | STRING | Yes | Yes |
| custom$empPassport$country | Country | STRING | Yes | Yes |
| custom$empPassport$issuedate | Issue Date | DATE | Yes | Yes |
| custom$empPassport$issuecity | Issue City | DATE | Yes | Yes |
| custom$empPassport$issueplace | Issue City | DATE | Yes | Yes |
| custom$empVisa$visanotype | visanotype | NUMBER | Yes | Yes |
| custom$empVisa$visano | visano | NUMBER | Yes | Yes |
| custom$empVisa$validity | validity | DATE | Yes | Yes |
| custom$empVisa$family | family | STRING | Yes | Yes |
| custom$empVisa$visatype | visatype | STRING | Yes | Yes |
| custom$empVisa$visaname | visaname | STRING | Yes | Yes |
| custom$empVisa$country | country | STRING | Yes | Yes |
| custom$empVisa$issuedate | issueDate | DATE | Yes | Yes |
| empIdentities$tblEmpIdentities$expirydate | expirydate | DATE | Yes | Yes |
| empIdentities$tblEmpIdentities$docverified | docverified | BOOLEAN | Yes | Yes |
| empIdentities$tblEmpIdentities$verifiedcolor | isverified | BOOLEAN | Yes | Yes |

### Family and nomination

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| custom$family$name | Name | STRING | Yes | Yes |
| custom$family$dob | Date of birth | DATE | Yes | Yes |
| custom$family$age | Age | STRING | Yes | Yes |
| custom$family$bloodgroup | Blood Group | STRING | Yes | Yes |
| custom$family$gender | Gender | STRING | Yes | Yes |
| custom$family$nationality | Nationality | STRING | Yes | Yes |
| custom$emppassport$passportno | Passport | NUMBER | Yes | Yes |
| custom$emppassport$expirydate | Expirydate | DATE | Yes | Yes |
| custom$emppassport$familyempmber | Family Member | STRING | Yes | Yes |
| custom$emppassport$passporttype | Passport Type | STRING | Yes | Yes |
| custom$emppassport$givenname | First name | STRING | Yes | Yes |
| custom$emppassport$middlename | Middle Name | STRING | Yes | Yes |
| custom$emppassport$surname | Surname | STRING | Yes | Yes |
| custom$emppassport$address | Address | STRING | Yes | Yes |
| custom$empPassport$currentlywith | Currently With | STRING | Yes | Yes |
| custom$empPassport$country | Country | STRING | Yes | Yes |
| custom$empPassport$issuedate | Issue Date | DATE | Yes | Yes |
| custom$empPassport$issuecity | Issue City | DATE | Yes | Yes |
| custom$empPassport$issueplace | Issue City | DATE | Yes | Yes |
| custom$empVisa$visanotype | visanotype | NUMBER | Yes | Yes |
| custom$empVisa$visano | visano | NUMBER | Yes | Yes |
| custom$empVisa$validity | validity | DATE | Yes | Yes |
| custom$empVisa$family | family | STRING | Yes | Yes |
| custom$empVisa$visatype | visatype | STRING | Yes | Yes |
| custom$empVisa$visaname | visaname | STRING | Yes | Yes |
| custom$empVisa$country | country | STRING | Yes | Yes |
| custom$empVisa$issuedate | issueDate | DATE | Yes | Yes |
| custom$nom$for | for | STRING | Yes | Yes |
| custom$nom$amount | amount | STRING | Yes | Yes |
| custom$nom$allminor | allminor | COMPOUND | Yes | Yes |
| custom$nom$allmental | allmental | COMPOUND | Yes | Yes |
| custom$nom$isminor | isminor | BOOLEAN | Yes | Yes |
| custom$nom$islunatic | islunatic | BOOLEAN | Yes | Yes |
| custom$nom$minor | minor | STRING | Yes | Yes |
| custom$nom$mental | mental | STRING | Yes | Yes |
| custom$nom$address | address | STRING | Yes | Yes |
| custom$nom$phone | phone | STRING | Yes | Yes |
| custom$nom$mobile | mobile | STRING | Yes | Yes |
| custom$nom$email | email | STRING | Yes | Yes |
| custom$nom$guardnamerelation | name | STRING | Yes | Yes |
| nomination$empNomination1$sharepercent | sharepercent | NUMBER | Yes | Yes |
| nomination$empFamily$namerelation | namerelation | STRING | Yes | Yes |

### Assets and access cards

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| custom$accesscard$accesscardno | Accesscardno | STRING | Yes | Yes |
| custom$accesscard$fromdate | FromDate | DATE | Yes | Yes |
| custom$accesscard$todate | ToDate | DATE | Yes | Yes |
| custom$accesscard$validity | Validity | STRING | Yes | Yes |
| assetsalloc$assetallocation$assettype | assettype | STRING | Yes | Yes |
| assetsalloc$assetallocation$model | model | STRING | Yes | Yes |
| assetsalloc$assetallocation$serialno | serialno | STRING | Yes | Yes |
| assetsalloc$assetallocation$assetdesc | assetdesc | STRING | Yes | Yes |
| assetsalloc$assetallocation$issuedate | issuedate | DATE | Yes | Yes |
| assetsalloc$assetallocation$status | status | STRING | Yes | Yes |
| assetsalloc$assetallocation$assetid | assetid | STRING | Yes | Yes |
| assetsalloc$assetallocation$assetno | assetno | STRING | Yes | Yes |
| assetsalloc$assetallocation$originalvalue | originalvalue | STRING | Yes | Yes |
| assetsalloc$assetallocation$value | value | STRING | Yes | Yes |
| assetsalloc$assetallocation$returndate | returndate | DATE | Yes | Yes |
| assetsalloc$assetallocation$remarks | remarks | STRING | Yes | Yes |
| assetsalloc$assetallocation$remarks_return | remarks_return | STRING | Yes | Yes |

### Insurance

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| id | Id | NUMBER | Yes | No |
| policyno | Policy Number | STRING | Yes | Yes |
| insuredsum | Sum Insured | NUMBER | Yes | Yes |
| issuedate | Issue Date | DATE | Yes | Yes |
| expirydate | Expiry Date | DATE | Yes | Yes |
| empInsuranceInfo$insuranceTypeInfo$insurancetype | insurancetypedescription | NUMBER | Yes | Yes |
| empInsuranceInfo$insuranceProvInfo$insuranceprovider | insuranceprovider | NUMBER | Yes | Yes |
| empFamilyInfo$familyInfo$family | familydescription | NUMBER | Yes | Yes |

### Employment and job

| Technical field | Source title | Type | Enabled | Mandatory flag |
|---|---|---|---|---|
| custom$work_history$company_name | company_name | STRING | Yes | Yes |
| custom$work_history$period | duration | STRING | Yes | Yes |
| custom$work_history$designation | designation | STRING | Yes | Yes |

This inspection discovers source fields; it does not confirm completeness, correctness, exportability or payroll applicability of their values. No schema change or stage/gate completion is recorded.
