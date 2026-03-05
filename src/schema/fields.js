/**
 * Field schema — 8 sections, each field with layer tag (given / framework / meant).
 *
 * Layers:
 *   given     — Raw observation, client-owned. Subject visible.
 *   framework — Contextual interpretation, shared under bridge agreement. Visibility varies.
 *   meant     — Institutional classification, org-level. Not subject visible.
 */

export const LAYERS = Object.freeze({
  GIVEN:     'given',
  FRAMEWORK: 'framework',
  MEANT:     'meant',
});

export const FIELD_TYPES = Object.freeze({
  TEXT:          'text',
  TEXT_LONG:     'text_long',
  DATE:          'date',
  SELECT:        'select',
  MULTI_SELECT:  'multi_select',
  BOOLEAN:       'boolean',
  NUMBER:        'number',
  PHONE:         'phone',
  EMAIL:         'email',
  DOCUMENT:      'document',
});

// ── Section definitions ─────────────────────────────────────────────

export const SECTIONS = [
  {
    key: 'identity_contact',
    label: 'Identity & Contact',
    icon: 'user',
    fields: [
      { key: 'preferred_name',   label: 'Preferred Name',     type: 'text',    layer: 'given' },
      { key: 'legal_name',       label: 'Legal Name',         type: 'text',    layer: 'given' },
      { key: 'dob',              label: 'Date of Birth',      type: 'date',    layer: 'given' },
      { key: 'gender',           label: 'Gender',             type: 'select',  layer: 'given',
        options: ['Male', 'Female', 'Non-binary', 'Transgender', 'Other', 'Prefer not to say'] },
      { key: 'pronouns',         label: 'Pronouns',           type: 'text',    layer: 'given' },
      { key: 'language',         label: 'Primary Language',   type: 'text',    layer: 'given' },
      { key: 'interpreter_needed', label: 'Interpreter Needed', type: 'boolean', layer: 'given' },
      { key: 'phone',            label: 'Phone',              type: 'phone',   layer: 'given' },
      { key: 'phone_safety',     label: 'Phone Safety',       type: 'select',  layer: 'given',
        options: ['Safe to call', 'Safe to text only', 'Not safe', 'Unknown'] },
      { key: 'email',            label: 'Email',              type: 'email',   layer: 'given' },
      { key: 'id_documents',     label: 'ID Documents',       type: 'text_long', layer: 'given' },
    ],
  },
  {
    key: 'housing',
    label: 'Housing',
    icon: 'home',
    fields: [
      { key: 'housing_status',       label: 'Housing Status',       type: 'select', layer: 'given',
        options: ['Literally Homeless', 'Emergency Shelter', 'Transitionally Housed', 'Permanently Housed', 'At Risk of Homelessness', 'Stably Housed', 'Unknown'] },
      { key: 'housing_duration',     label: 'Duration in Current',  type: 'text',   layer: 'given' },
      { key: 'housing_history',      label: 'Housing History',      type: 'text_long', layer: 'given' },
      { key: 'eviction_risk',        label: 'Eviction Risk',        type: 'select', layer: 'given',
        options: ['None', 'Low', 'Moderate', 'High', 'Imminent', 'Unknown'] },
      { key: 'housing_barriers',     label: 'Barriers',             type: 'text_long', layer: 'given' },
      { key: 'housing_goal',         label: 'Housing Goal',         type: 'text',   layer: 'given' },
      { key: 'program_classification', label: 'Program Classification', type: 'select', layer: 'meant',
        options: ['ES', 'TH', 'RRH', 'PSH', 'OPH', 'HP', 'Other'] },
    ],
  },
  {
    key: 'income_employment',
    label: 'Income & Employment',
    icon: 'dollar-sign',
    fields: [
      { key: 'monthly_income',     label: 'Monthly Income',      type: 'number',  layer: 'given' },
      { key: 'income_sources',     label: 'Income Sources',      type: 'text_long', layer: 'given' },
      { key: 'employment_status',  label: 'Employment Status',   type: 'select',  layer: 'given',
        options: ['Employed Full-Time', 'Employed Part-Time', 'Unemployed — Seeking', 'Unemployed — Not Seeking', 'Retired', 'Disabled', 'Student', 'Other'] },
      { key: 'employer',           label: 'Employer',            type: 'text',    layer: 'given' },
      { key: 'benefits_receiving', label: 'Benefits Receiving',  type: 'multi_select', layer: 'given',
        options: ['SNAP', 'SSI', 'SSDI', 'TANF', 'WIC', 'Section 8', 'VA Benefits', 'Unemployment', 'Other'] },
      { key: 'benefits_applied',   label: 'Benefits Applied For', type: 'multi_select', layer: 'given',
        options: ['SNAP', 'SSI', 'SSDI', 'TANF', 'WIC', 'Section 8', 'VA Benefits', 'Unemployment', 'Other'] },
      { key: 'ami_percent',        label: 'AMI %',               type: 'number',  layer: 'meant' },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    icon: 'heart-pulse',
    fields: [
      { key: 'insurance',        label: 'Insurance',           type: 'select', layer: 'given',
        options: ['Medicaid', 'Medicare', 'Private', 'VA', 'None', 'Unknown', 'Other'] },
      { key: 'primary_care',     label: 'Primary Care',        type: 'boolean', layer: 'given' },
      { key: 'physical_health',  label: 'Physical Health',     type: 'text_long', layer: 'given' },
      { key: 'mental_health',    label: 'Mental Health',       type: 'text_long', layer: 'given' },
      { key: 'health_provider',  label: 'Health Provider',     type: 'text',    layer: 'given' },
      { key: 'substance_use',    label: 'Substance Use',       type: 'text_long', layer: 'given' },
      { key: 'medications',      label: 'Medications',         type: 'text_long', layer: 'given' },
      { key: 'disability_status', label: 'Disability Status',  type: 'select',  layer: 'given',
        options: ['None', 'Physical', 'Mental', 'Both', 'Unknown', 'Prefer not to say'] },
    ],
  },
  {
    key: 'safety',
    label: 'Safety',
    icon: 'shield',
    fields: [
      { key: 'safety_assessment',  label: 'Overall Assessment',  type: 'select', layer: 'given',
        options: ['No concerns', 'Minor concerns', 'Moderate concerns', 'Serious concerns', 'Immediate danger', 'Unknown'] },
      { key: 'dv_ipv_screening',   label: 'DV/IPV Screening',   type: 'select', layer: 'given',
        options: ['No indicators', 'Past DV/IPV', 'Current DV/IPV', 'Declined to answer', 'Not screened'] },
      { key: 'safety_plan',        label: 'Safety Plan',         type: 'boolean', layer: 'given' },
      { key: 'children_in_home',   label: 'Children in Home',    type: 'number',  layer: 'given' },
      { key: 'dcf_involvement',    label: 'DCF Involvement',     type: 'select',  layer: 'given',
        options: ['None', 'Past', 'Active', 'Unknown'] },
      { key: 'legal_issues',       label: 'Legal Issues',        type: 'text_long', layer: 'given' },
    ],
  },
  {
    key: 'household_support',
    label: 'Household & Support',
    icon: 'users',
    fields: [
      { key: 'household_size',     label: 'Household Size',       type: 'number',   layer: 'given' },
      { key: 'household_members',  label: 'Household Members',    type: 'text_long', layer: 'given' },
      { key: 'dependents',         label: 'Dependents',           type: 'number',   layer: 'given' },
      { key: 'informal_support',   label: 'Informal Support',     type: 'text_long', layer: 'given' },
      { key: 'emergency_contact',  label: 'Emergency Contact',    type: 'text',     layer: 'given' },
      { key: 'veteran_status',     label: 'Veteran Status',       type: 'boolean',  layer: 'given' },
    ],
  },
  {
    key: 'services_referrals',
    label: 'Services & Referrals',
    icon: 'clipboard-list',
    fields: [
      { key: 'case_status',       label: 'Case Status',         type: 'select', layer: 'given',
        options: ['Intake', 'Active', 'Inactive', 'Closed', 'Transferred'] },
      { key: 'programs_enrolled',  label: 'Programs Enrolled',   type: 'text_long', layer: 'given' },
      { key: 'housing_referral',   label: 'Housing Referral',    type: 'text',   layer: 'given' },
      { key: 'benefits_referral',  label: 'Benefits Referral',   type: 'text',   layer: 'given' },
      { key: 'mh_referral',       label: 'Mental Health Referral', type: 'text', layer: 'given' },
      { key: 'legal_referral',    label: 'Legal Referral',       type: 'text',   layer: 'given' },
      { key: 'other_referral',    label: 'Other Referral',       type: 'text',   layer: 'given' },
      { key: 'service_barriers',  label: 'Service Barriers',     type: 'text_long', layer: 'given' },
      { key: 'hmis_id',           label: 'HMIS ID',              type: 'text',   layer: 'meant' },
    ],
  },
  {
    key: 'goals_notes',
    label: 'Goals & Notes',
    icon: 'target',
    fields: [
      { key: 'client_goals',      label: 'Client Goals',         type: 'text_long', layer: 'given' },
      { key: 'worker_assessment',  label: 'Worker Assessment',    type: 'text_long', layer: 'framework' },
      { key: 'agreed_next_steps',  label: 'Agreed Next Steps',    type: 'text_long', layer: 'given' },
      { key: 'next_contact_date',  label: 'Next Contact Date',    type: 'date',      layer: 'given' },
      { key: 'case_notes',        label: 'Case Notes',            type: 'text_long', layer: 'framework' },
    ],
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────

const _fieldMap = new Map();
const _sectionMap = new Map();

for (const section of SECTIONS) {
  for (const field of section.fields) {
    _fieldMap.set(field.key, { ...field, section: section.key, sectionLabel: section.label, sectionIcon: section.icon });
    _sectionMap.set(field.key, section.key);
  }
}

export function getField(fieldKey) {
  return _fieldMap.get(fieldKey) || null;
}

export function getSection(fieldKey) {
  return _sectionMap.get(fieldKey) || null;
}

export function getAllFieldKeys() {
  return [..._fieldMap.keys()];
}

export function getFieldsBySection(sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  return section ? section.fields : [];
}

export function isSubjectVisible(fieldKey) {
  const field = _fieldMap.get(fieldKey);
  if (!field) return false;
  return field.layer === 'given' || field.layer === 'framework';
}
