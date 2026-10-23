export const PORTFOLIOS = ['M3M Gurgaon', 'M3M Noida', 'Smartworld'];

export const PROJECT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
];

export const CATEGORIES = {
  residential: [
    { value: 'mid-end', label: 'Mid-end' },
    { value: 'premium', label: 'Premium' },
    { value: 'affluent', label: 'Affluent' },
  ],
  commercial: [
    { value: 'hi_street', label: 'High street' },
    { value: 'enclosed_mall', label: 'Enclosed mall' },
  ],
};
export const ALL_CATEGORIES = [...CATEGORIES.residential, ...CATEGORIES.commercial];
export const categoryLabel = (v) => ALL_CATEGORIES.find((c) => c.value === v)?.label || v || '—';

export const CLASSIFICATIONS = ['Delivered', 'Ongoing (RERA Obtained)', 'Future (License Applied)'];

export const ROLES = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'general_admin', label: 'Department head' },
  { value: 'general_contributor', label: 'Department member' },
  { value: 'design_admin', label: 'Design head' },
  { value: 'design_contributor', label: 'Design member' },
];
export const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || (v || '').replace(/_/g, ' ');

export const DEPARTMENTS = [
  { value: 'super_admin', label: 'Administration' },
  { value: 'design', label: 'Design' },
  { value: 'design_arch', label: 'Design – Architecture' },
  { value: 'design_str', label: 'Design – Structure' },
  { value: 'design_mep', label: 'Design – MEP' },
  { value: 'structure', label: 'Structure' },
  { value: 'mep', label: 'MEP' },
  { value: 'interior', label: 'Interior design' },
  { value: 'pmo', label: 'PMO' },
  { value: 'cp', label: 'Contracts & procurement' },
  { value: 'liaison', label: 'Liaison' },
  { value: 'pmo_budget', label: 'PMO budget' },
  { value: 'bt', label: 'BT' },
  { value: 'pl', label: 'P&L' },
];
export const deptLabel = (v) => DEPARTMENTS.find((d) => d.value === v)?.label || v || '—';

export const COMPANIES = [
  { value: 'm3m_gurgaon', label: 'M3M Gurgaon' },
  { value: 'm3m_noida', label: 'M3M Noida' },
  { value: 'smart_world', label: 'Smart World' },
];
export const companyLabel = (v) => COMPANIES.find((c) => c.value === v)?.label || v || '—';

export const isAdmin = (u) => !!u && (u.role === 'super_admin' || u.department === 'super_admin');
export const canManageProjects = (u) => isAdmin(u) || (u?.department === 'design' && ['design_admin', 'design_contributor'].includes(u?.role));

// Modules that can be granted per department (names match the module list from the API)
export const ACCESS_MODULES = ['Key Ratio', 'Apartment Design', 'Common Design', 'Commercial Complex Design Considerations'];
// Default access when no record has been saved for a department
export const DEFAULT_ACCESS = {
  design: { 'Key Ratio': 'edit', 'Apartment Design': 'edit', 'Common Design': 'edit', 'Commercial Complex Design Considerations': 'edit' },
  design_arch: { 'Key Ratio': 'view', 'Apartment Design': 'view', 'Common Design': 'view' },
  design_str: { 'Key Ratio': 'view' },
  design_mep: { 'Key Ratio': 'view' },
  structure: { 'Key Ratio': 'view' },
  mep: { 'Key Ratio': 'view' },
  interior: { 'Apartment Design': 'edit', 'Common Design': 'edit' },
  pmo: { 'Key Ratio': 'view', 'Apartment Design': 'view', 'Common Design': 'view' },
};

export const AUDIT_TYPES = [
  'Project Creation', 'Project Updated', 'Project Deleted', 'Task Assigned', 'Task Completed', 'Record Deleted',
  'User Login', 'Password Reset', 'User Created', 'User Updated', 'User Deleted', 'PDF Exported',
];

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const cr = (n) => `₹${Math.round(n).toLocaleString('en-IN')} Cr`;
