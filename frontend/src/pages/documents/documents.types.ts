/** DOC-02 HTTP response fields; independent of backend source. */
export interface DocType {
  code: string;
  name: string;
  typicallyExpires: boolean;
}
export interface VaultRow {
  id: number;
  employeeId: number;
  ecode: string | null;
  employeeName: string | null;
  typeName: string;
  originalName: string;
  uploadedAt: string;
  expiresOn: string | null;
  status: string;
  expiry: { state: 'perpetual' | 'valid' | 'expiring' | 'expired'; daysRemaining: number | null };
}
