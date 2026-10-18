/** LC-01/02: intake and explicit actual-joining confirmation, using existing UI primitives. */
import type { Dispatch, SetStateAction } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Checkbox, Drawer, TextField, Select, type SelectOption } from '../../ui';
import { OnboardingApplicationReview } from './OnboardingApplicationReview';
import { todayISOIST, formatCalendarDate } from '../../lib/date';
import type { CandidateItem, IngestForm, JoiningForm } from './onboarding-types';
interface Props {
  ingestError: string | null;
  ingesting: boolean;
  ingestOpen: boolean;
  setIngestOpen: (open: boolean) => void;
  ingestForm: IngestForm;
  setIngestForm: Dispatch<SetStateAction<IngestForm>>;
  convertOpen: boolean;
  setConvertOpen: (open: boolean) => void;
  convertForm: JoiningForm;
  setConvertForm: Dispatch<SetStateAction<JoiningForm>>;
  selectedCandidate: CandidateItem | null;
  applicationReady: boolean;
  setApplicationReady: (ready: boolean) => void;
  joiningConfirmed: boolean;
  setJoiningConfirmed: (confirmed: boolean) => void;
  converting: boolean;
  conversionError: string | null;
  references: { loading: boolean; error: string | null };
  ORG_UNIT_OPTIONS: SelectOption[];
  COMPANY_OPTIONS: SelectOption[];
  DEPARTMENT_OPTIONS: SelectOption[];
  DESIGNATION_OPTIONS: SelectOption[];
  LOCATION_OPTIONS: SelectOption[];
  STRUCTURE_OPTIONS: SelectOption[];
  handleIngestSubmit: () => Promise<void>;
  handleConvertSubmit: () => Promise<void>;
}
export function OnboardingDrawers({
  ingestError,
  ingesting,
  ingestOpen,
  setIngestOpen,
  ingestForm,
  setIngestForm,
  convertOpen,
  setConvertOpen,
  convertForm,
  setConvertForm,
  selectedCandidate,
  applicationReady,
  setApplicationReady,
  joiningConfirmed,
  setJoiningConfirmed,
  converting,
  conversionError,
  references,
  ORG_UNIT_OPTIONS,
  COMPANY_OPTIONS,
  DEPARTMENT_OPTIONS,
  DESIGNATION_OPTIONS,
  LOCATION_OPTIONS,
  STRUCTURE_OPTIONS,
  handleIngestSubmit,
  handleConvertSubmit,
}: Props) {
  return (
    <>
      {/* Ingest Candidate Drawer */}
      <Drawer
        open={ingestOpen}
        onClose={() => {
          if (!ingesting) setIngestOpen(false);
        }}
        title="Add an accepted candidate"
        subtitle="Add accepted candidate details and generate a secure pre-join link."
      >
        <div className="space-y-4 p-4">
          <TextField
            label="Full Name"
            value={ingestForm.fullName}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, fullName: e.target.value });
            }}
            placeholder="e.g. Suman Roy"
          />
          <TextField
            label="Personal Email"
            value={ingestForm.personalEmail}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, personalEmail: e.target.value });
            }}
            placeholder="suman.roy@example.com"
          />
          <TextField
            label="Mobile Number (10 digits)"
            value={ingestForm.mobile}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, mobile: e.target.value });
            }}
            placeholder="9876543210"
          />
          <TextField
            label="Position Title"
            value={ingestForm.positionTitle}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, positionTitle: e.target.value });
            }}
            placeholder="Senior Mechanical Engineer"
          />
          <Select
            label="Legal Company"
            value={ingestForm.companyId}
            onChange={(val) => {
              setIngestForm({ ...ingestForm, companyId: val });
            }}
            options={COMPANY_OPTIONS}
          />
          <TextField
            label="Offered CTC (Annual ₹)"
            value={ingestForm.offeredCtc}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, offeredCtc: e.target.value });
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Offer Date"
              type="date"
              value={ingestForm.offerDate}
              onChange={(e) => {
                setIngestForm({ ...ingestForm, offerDate: e.target.value });
              }}
            />
            <TextField
              label="Proposed DOJ"
              type="date"
              value={ingestForm.proposedDoj}
              onChange={(e) => {
                setIngestForm({ ...ingestForm, proposedDoj: e.target.value });
              }}
            />
          </div>
          <TextField
            label="Previous Employer"
            value={ingestForm.previousCompany}
            onChange={(e) => {
              setIngestForm({ ...ingestForm, previousCompany: e.target.value });
            }}
          />

          {ingestError && (
            <p role="alert" className="text-sm text-negative">
              {ingestError}
            </p>
          )}
          {references.error && (
            <p role="alert" className="text-sm text-negative">
              Master choices unavailable: {references.error}
            </p>
          )}
          <div className="pt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={ingesting}
              onClick={() => {
                setIngestOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={ingesting}
              disabled={references.loading || Boolean(references.error)}
              onClick={() => {
                void handleIngestSubmit();
              }}
            >
              Add candidate & generate link
            </Button>
          </div>
        </div>
      </Drawer>

      {/* HR Conversion Wizard Drawer */}
      <Drawer
        open={convertOpen}
        onClose={() => {
          if (!converting) setConvertOpen(false);
        }}
        title="Confirm joining and create employee"
        subtitle="Review the completed application and actual joining before issuing the permanent company-prefix ID."
      >
        {selectedCandidate && (
          <div className="space-y-4 p-4">
            <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">{selectedCandidate.fullName}</p>
              <p className="text-ink-muted">
                Offered CTC: ₹{Number(selectedCandidate.offeredCtc).toLocaleString('en-IN')}
              </p>
              <p className="text-ink-muted">
                Proposed DOJ: {formatCalendarDate(selectedCandidate.proposedDoj)}
              </p>
              <p className="text-sm text-ink">
                {selectedCandidate.status === 'prejoin_done' && selectedCandidate.hasPrejoinData
                  ? 'Application submitted — HR review required'
                  : 'Application not yet completed'}
              </p>
            </div>

            <OnboardingApplicationReview
              candidateId={selectedCandidate.id}
              onReady={setApplicationReady}
            />
            <Select
              label="Employing Company"
              value={convertForm.companyId}
              disabled
              onChange={() => {
                /* The accepted employing entity is fixed for this conversion. */
              }}
              options={COMPANY_OPTIONS}
            />
            <Select
              label="Organisational unit"
              value={convertForm.orgUnitId}
              options={ORG_UNIT_OPTIONS}
              onChange={(orgUnitId) => {
                setConvertForm({ ...convertForm, orgUnitId });
              }}
            />
            <Select
              label="Department"
              value={convertForm.departmentId}
              onChange={(val) => {
                setConvertForm({ ...convertForm, departmentId: val });
              }}
              options={DEPARTMENT_OPTIONS}
            />
            <Select
              label="Designation"
              value={convertForm.designationId}
              onChange={(val) => {
                setConvertForm({ ...convertForm, designationId: val });
              }}
              options={DESIGNATION_OPTIONS}
            />
            <Select
              label="Work Location"
              value={convertForm.locationId}
              onChange={(val) => {
                setConvertForm({ ...convertForm, locationId: val });
              }}
              options={LOCATION_OPTIONS}
            />
            <TextField
              label="Corporate Work Email"
              value={convertForm.workEmail}
              onChange={(e) => {
                setConvertForm({ ...convertForm, workEmail: e.target.value });
              }}
            />
            <TextField
              label="Actual Date of Joining"
              type="date"
              max={todayISOIST()}
              value={convertForm.doj}
              onChange={(e) => {
                setConvertForm({ ...convertForm, doj: e.target.value });
              }}
            />
            <Select
              label="Salary Structure Assignment"
              value={convertForm.salaryStructureId}
              onChange={(val) => {
                setConvertForm({ ...convertForm, salaryStructureId: val });
              }}
              options={STRUCTURE_OPTIONS}
            />

            {conversionError && (
              <p role="alert" className="text-sm text-negative">
                {conversionError}
              </p>
            )}
            {references.error && (
              <p role="alert" className="text-sm text-negative">
                Master choices unavailable: {references.error}
              </p>
            )}
            <Checkbox
              label="HR has reviewed the completed application and confirmed this person has actually joined"
              checked={joiningConfirmed}
              disabled={converting || !applicationReady}
              onChange={(event) => {
                setJoiningConfirmed(event.currentTarget.checked);
              }}
            />
            <p className="text-xs text-ink-muted">
              Before this confirmation the person remains a candidate and has no permanent employee
              ID or employee MIS entry.
            </p>

            <div className="pt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={converting}
                onClick={() => {
                  setConvertOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                leadingIcon={<Sparkles className="h-4 w-4" />}
                loading={converting}
                disabled={
                  !applicationReady ||
                  !joiningConfirmed ||
                  references.loading ||
                  Boolean(references.error) ||
                  selectedCandidate.status !== 'prejoin_done' ||
                  !selectedCandidate.hasPrejoinData
                }
                onClick={() => {
                  void handleConvertSubmit();
                }}
              >
                Confirm joining & create employee
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
