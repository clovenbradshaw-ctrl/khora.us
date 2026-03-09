/**
 * Seed events — realistic demo data for a case scenario.
 *
 * Scenario: Maria Gonzalez, intake through housing stabilization.
 * Multiple agents, epistemic modes, supersessions, and a contested field.
 */

const SEED_EVENTS = [
  // ── Event 1: Case Creation (Intake) ────────────────────────────────
  {
    id: 'evt_intake_001',
    date: '2025-06-15T09:30:00Z',
    label: 'Intake opened',
    agent: '@jreyes:khora.us',
    agentRole: 'Intake Worker',
    ops: [
      { op: 'NUL', field: null, note: 'Case brought out of void.' },

      // Identity & Contact
      { op: 'SIG', field: 'preferred_name', claimId: 'pn1', value: 'Maria', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client introduced herself.' },
      { op: 'INS', field: 'preferred_name', claimId: 'pn1' },

      { op: 'SIG', field: 'legal_name', claimId: 'ln1', value: 'Maria Elena Gonzalez', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Per client.' },
      { op: 'INS', field: 'legal_name', claimId: 'ln1' },

      { op: 'SIG', field: 'dob', claimId: 'dob1', value: '1988-03-14', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client self-reported.' },
      { op: 'INS', field: 'dob', claimId: 'dob1' },

      { op: 'SIG', field: 'gender', claimId: 'g1', value: 'Female', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'gender', claimId: 'g1' },

      { op: 'SIG', field: 'pronouns', claimId: 'pr1', value: 'she/her', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'pronouns', claimId: 'pr1' },

      { op: 'SIG', field: 'language', claimId: 'lang1', value: 'Spanish', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'observed', note: 'Interview conducted in Spanish.' },
      { op: 'INS', field: 'language', claimId: 'lang1' },

      { op: 'SIG', field: 'interpreter_needed', claimId: 'int1', value: 'Yes', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'observed', note: 'Client more comfortable in Spanish.' },
      { op: 'INS', field: 'interpreter_needed', claimId: 'int1' },

      { op: 'SIG', field: 'phone', claimId: 'ph1', value: '(617) 555-0147', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'phone', claimId: 'ph1' },

      { op: 'SIG', field: 'phone_safety', claimId: 'ps1', value: 'Safe to text only', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client asked us to text, not call.' },
      { op: 'INS', field: 'phone_safety', claimId: 'ps1' },

      // Housing
      { op: 'SIG', field: 'housing_status', claimId: 'h1', value: 'Emergency Shelter', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client staying at Pine St Inn.' },
      { op: 'INS', field: 'housing_status', claimId: 'h1' },

      { op: 'SIG', field: 'housing_duration', claimId: 'hd1', value: '3 weeks', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'housing_duration', claimId: 'hd1' },

      // Income
      { op: 'SIG', field: 'monthly_income', claimId: 'mi1', value: '1200', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client reported part-time work income.' },
      { op: 'INS', field: 'monthly_income', claimId: 'mi1' },

      { op: 'SIG', field: 'employment_status', claimId: 'es1', value: 'Employed Part-Time', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'employment_status', claimId: 'es1' },

      // Safety
      { op: 'SIG', field: 'safety_assessment', claimId: 'sa1', value: 'Minor concerns', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'observed', note: 'Client appeared anxious but no immediate safety concern.' },
      { op: 'INS', field: 'safety_assessment', claimId: 'sa1' },

      { op: 'SIG', field: 'children_in_home', claimId: 'ch1', value: '2', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Ages 4 and 7.' },
      { op: 'INS', field: 'children_in_home', claimId: 'ch1' },

      // Services
      { op: 'SIG', field: 'case_status', claimId: 'cs1', value: 'Intake', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'measured' },
      { op: 'INS', field: 'case_status', claimId: 'cs1' },

      // Household
      { op: 'SIG', field: 'household_size', claimId: 'hs1', value: '3', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client plus two children.' },
      { op: 'INS', field: 'household_size', claimId: 'hs1' },

      { op: 'SIG', field: 'dependents', claimId: 'dep1', value: '2', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared' },
      { op: 'INS', field: 'dependents', claimId: 'dep1' },
    ],
  },

  // ── Event 2: Benefits check (same day) ─────────────────────────────
  {
    id: 'evt_benefits_002',
    date: '2025-06-15T14:00:00Z',
    label: 'Benefits screening completed',
    agent: '@jreyes:khora.us',
    agentRole: 'Intake Worker',
    ops: [
      { op: 'SIG', field: 'insurance', claimId: 'ins1', value: 'None', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Client reports no current insurance.' },
      { op: 'INS', field: 'insurance', claimId: 'ins1' },

      { op: 'SIG', field: 'benefits_receiving', claimId: 'br1', value: 'SNAP', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Receiving SNAP benefits.' },
      { op: 'INS', field: 'benefits_receiving', claimId: 'br1' },

      { op: 'SIG', field: 'benefits_applied', claimId: 'ba1', value: 'SSI, Medicaid', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'declared', note: 'Applied for SSI and Medicaid last month.' },
      { op: 'INS', field: 'benefits_applied', claimId: 'ba1' },

      { op: 'SIG', field: 'housing_referral', claimId: 'hr1', value: 'HomeStart RRH Program', agent: '@jreyes:khora.us', role: 'Intake Worker', mode: 'measured', note: 'Referral submitted.' },
      { op: 'INS', field: 'housing_referral', claimId: 'hr1' },
    ],
  },

  // ── Event 3: Case activation by assigned caseworker ────────────────
  {
    id: 'evt_activate_003',
    date: '2025-06-18T10:15:00Z',
    label: 'Case assigned and activated',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SEG', field: 'case_status', note: 'Cut between intake and active status.' },
      { op: 'ALT', field: 'case_status', claimId: 'cs2', value: 'Active', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'cs1', note: 'Case assigned to T. Khan.' },
      { op: 'CON', field: 'case_status', claimId: 'cs2', supersedes: 'cs1' },

      { op: 'SIG', field: 'email', claimId: 'em1', value: 'maria.g.88@gmail.com', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', note: 'Client provided email at first meeting.' },
      { op: 'INS', field: 'email', claimId: 'em1' },

      { op: 'SIG', field: 'client_goals', claimId: 'cg1', value: 'Find stable housing for family. Get kids enrolled in school near new apartment.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', note: 'From goal-setting conversation.' },
      { op: 'INS', field: 'client_goals', claimId: 'cg1' },

      { op: 'SIG', field: 'next_contact_date', claimId: 'ncd1', value: '2025-06-25', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured' },
      { op: 'INS', field: 'next_contact_date', claimId: 'ncd1' },

      { op: 'SIG', field: 'agreed_next_steps', claimId: 'ans1', value: 'Gather documents for housing application. Schedule Medicaid follow-up.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared' },
      { op: 'INS', field: 'agreed_next_steps', claimId: 'ans1' },
    ],
  },

  // ── Event 4: ID document verification ──────────────────────────────
  {
    id: 'evt_docs_004',
    date: '2025-06-22T11:00:00Z',
    label: 'ID documents verified',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SIG', field: 'id_documents', claimId: 'id1', value: 'State ID (MA) — verified. Birth certificates for both children — verified.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', note: 'Reviewed originals in office.' },
      { op: 'INS', field: 'id_documents', claimId: 'id1' },

      // Verify DOB from ID
      { op: 'SEG', field: 'dob', note: 'Cut between declared and measured source.' },
      { op: 'ALT', field: 'dob', claimId: 'dob2', value: '1988-03-14', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'dob1', note: 'Confirmed from state ID.' },
      { op: 'CON', field: 'dob', claimId: 'dob2', supersedes: 'dob1' },

      // Verify legal name from ID
      { op: 'SEG', field: 'legal_name', note: 'Cut between declared and measured.' },
      { op: 'ALT', field: 'legal_name', claimId: 'ln2', value: 'Maria Elena Gonzalez', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'ln1', note: 'Matches state ID exactly.' },
      { op: 'CON', field: 'legal_name', claimId: 'ln2', supersedes: 'ln1' },
    ],
  },

  // ── Event 5: Housing update — income discrepancy (SUP/contested) ───
  {
    id: 'evt_income_005',
    date: '2025-07-02T14:30:00Z',
    label: 'Income verification attempted',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      // Pay stubs show different income than reported
      { op: 'SEG', field: 'monthly_income', note: 'Cut before superposition — pay stubs differ from declaration.' },
      { op: 'SUP', field: 'monthly_income', claimId: 'mi2', value: '1650', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', contestNote: 'Pay stubs show $1650/month. Client originally reported $1200. Holding both — may be variable income.', note: 'From two recent pay stubs provided by client.' },

      // Housing update
      { op: 'SIG', field: 'housing_history', claimId: 'hh1', value: 'Lived with partner until May 2025. Left due to safety concerns. Shelter since early June.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', note: 'Client disclosed housing history.' },
      { op: 'INS', field: 'housing_history', claimId: 'hh1' },

      { op: 'SIG', field: 'eviction_risk', claimId: 'er1', value: 'None', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'observed', note: 'Currently in shelter — no eviction risk applies.' },
      { op: 'INS', field: 'eviction_risk', claimId: 'er1' },
    ],
  },

  // ── Event 6: Safety screening by supervisor ────────────────────────
  {
    id: 'evt_safety_006',
    date: '2025-07-05T09:00:00Z',
    label: 'Safety screening — supervisor review',
    agent: '@mchen:khora.us',
    agentRole: 'Supervisor',
    ops: [
      // DV/IPV screening
      { op: 'SIG', field: 'dv_ipv_screening', claimId: 'dv1', value: 'Past DV/IPV', agent: '@mchen:khora.us', role: 'Supervisor', mode: 'observed', note: 'Based on housing history and interview with client.' },
      { op: 'INS', field: 'dv_ipv_screening', claimId: 'dv1' },

      { op: 'SIG', field: 'safety_plan', claimId: 'sp1', value: 'Yes', agent: '@mchen:khora.us', role: 'Supervisor', mode: 'measured', note: 'Safety plan created and filed.' },
      { op: 'INS', field: 'safety_plan', claimId: 'sp1' },

      // Upgrade safety assessment — supervisor sees it differently than intake
      { op: 'SEG', field: 'safety_assessment', note: 'Cut before superposition — supervisor assessment differs.' },
      { op: 'SUP', field: 'safety_assessment', claimId: 'sa2', value: 'Moderate concerns', agent: '@mchen:khora.us', role: 'Supervisor', mode: 'observed', contestNote: 'Different agents — intake worker said minor, supervisor assessment is moderate given DV history.', note: 'DV history and children in home warrant moderate classification.' },

      // Mental health referral
      { op: 'SIG', field: 'mh_referral', claimId: 'mhr1', value: 'Referred to BMC trauma counseling', agent: '@mchen:khora.us', role: 'Supervisor', mode: 'measured', note: 'Referral submitted.' },
      { op: 'INS', field: 'mh_referral', claimId: 'mhr1' },
    ],
  },

  // ── Event 7: Medicaid confirmed ────────────────────────────────────
  {
    id: 'evt_medicaid_007',
    date: '2025-07-10T16:00:00Z',
    label: 'Medicaid enrollment confirmed',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SEG', field: 'insurance', note: 'Cut between none and Medicaid.' },
      { op: 'ALT', field: 'insurance', claimId: 'ins2', value: 'Medicaid', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'ins1', note: 'MassHealth approval letter received.' },
      { op: 'CON', field: 'insurance', claimId: 'ins2', supersedes: 'ins1' },

      { op: 'SIG', field: 'primary_care', claimId: 'pc1', value: 'Yes', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', note: 'Assigned to BMC primary care.' },
      { op: 'INS', field: 'primary_care', claimId: 'pc1' },

      { op: 'SIG', field: 'health_provider', claimId: 'hp1', value: 'Boston Medical Center', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured' },
      { op: 'INS', field: 'health_provider', claimId: 'hp1' },
    ],
  },

  // ── Event 8: Housing stabilization progress ────────────────────────
  {
    id: 'evt_housing_008',
    date: '2025-07-22T10:00:00Z',
    label: 'Housing application submitted',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SIG', field: 'housing_goal', claimId: 'hg1', value: '2-bedroom apartment in Dorchester/Roxbury area', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', note: 'Client wants to stay near her support network.' },
      { op: 'INS', field: 'housing_goal', claimId: 'hg1' },

      { op: 'SIG', field: 'housing_barriers', claimId: 'hb1', value: 'Limited credit history. No recent rental references. Income may be below requirement for some units.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'observed' },
      { op: 'INS', field: 'housing_barriers', claimId: 'hb1' },

      { op: 'SIG', field: 'programs_enrolled', claimId: 'pe1', value: 'HomeStart RRH, SNAP, MassHealth', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured' },
      { op: 'INS', field: 'programs_enrolled', claimId: 'pe1' },

      { op: 'SIG', field: 'worker_assessment', claimId: 'wa1', value: 'Client is engaged and motivated. Children are stable in school. Main barrier is affordable housing availability. Income situation needs clarification.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'observed' },
      { op: 'INS', field: 'worker_assessment', claimId: 'wa1' },

      // Update next contact
      { op: 'SEG', field: 'next_contact_date', note: 'Scheduling next check-in.' },
      { op: 'ALT', field: 'next_contact_date', claimId: 'ncd2', value: '2025-08-01', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'ncd1' },
      { op: 'CON', field: 'next_contact_date', claimId: 'ncd2', supersedes: 'ncd1' },

      { op: 'SIG', field: 'case_notes', claimId: 'cn1', value: 'Submitted RRH application to HomeStart. Landlord outreach pending. Client meeting with housing search specialist next week.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'observed' },
      { op: 'INS', field: 'case_notes', claimId: 'cn1' },
    ],
  },

  // ── Event 9: Income resolution (SYN) ───────────────────────────────
  {
    id: 'evt_income_resolve_009',
    date: '2025-07-28T11:30:00Z',
    label: 'Income clarified with employer letter',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      // Resolve the income contest — employer letter confirms variable income
      { op: 'SYN', field: 'monthly_income', claimId: 'mi3', value: '1450', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', note: 'Employer verification letter confirms average $1450/month. Variable hours explain discrepancy between $1200 (declared) and $1650 (pay stubs for a good month).' },

      // Update employment details
      { op: 'SIG', field: 'employer', claimId: 'emp1', value: 'Sunrise Cleaning Services', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', note: 'From employer verification letter.' },
      { op: 'INS', field: 'employer', claimId: 'emp1' },

      { op: 'SIG', field: 'income_sources', claimId: 'is1', value: 'Part-time employment (Sunrise Cleaning Services, ~25-35 hrs/week). SNAP benefits.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured' },
      { op: 'INS', field: 'income_sources', claimId: 'is1' },
    ],
  },

  // ── Event 10: Emergency contact & support ──────────────────────────
  {
    id: 'evt_support_010',
    date: '2025-08-05T09:45:00Z',
    label: 'Support network documented',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SIG', field: 'emergency_contact', claimId: 'ec1', value: 'Rosa Gonzalez (sister) — (617) 555-0283', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared' },
      { op: 'INS', field: 'emergency_contact', claimId: 'ec1' },

      { op: 'SIG', field: 'informal_support', claimId: 'isup1', value: 'Sister Rosa nearby in Dorchester. Church community at St. Peter\'s. Children\'s school staff are supportive.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', note: 'Client described her support system.' },
      { op: 'INS', field: 'informal_support', claimId: 'isup1' },

      { op: 'SIG', field: 'household_members', claimId: 'hm1', value: 'Maria (37, head of household). Sofia (7, daughter). Diego (4, son).', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared' },
      { op: 'INS', field: 'household_members', claimId: 'hm1' },

      { op: 'SIG', field: 'veteran_status', claimId: 'vs1', value: 'No', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared' },
      { op: 'INS', field: 'veteran_status', claimId: 'vs1' },
    ],
  },

  // ── Event 11: Housing placement ────────────────────────────────────
  {
    id: 'evt_housed_011',
    date: '2025-08-20T15:00:00Z',
    label: 'Housing secured — lease signed',
    agent: '@tkhan:khora.us',
    agentRole: 'Caseworker',
    ops: [
      { op: 'SEG', field: 'housing_status', note: 'Cut between shelter and housed.' },
      { op: 'ALT', field: 'housing_status', claimId: 'h2', value: 'Transitionally Housed', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'h1', note: 'RRH unit secured. Lease signed today.' },
      { op: 'CON', field: 'housing_status', claimId: 'h2', supersedes: 'h1' },

      { op: 'SEG', field: 'housing_duration', note: 'Reset duration for new housing.' },
      { op: 'ALT', field: 'housing_duration', claimId: 'hd2', value: 'Move-in August 25', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'hd1' },
      { op: 'CON', field: 'housing_duration', claimId: 'hd2', supersedes: 'hd1' },

      { op: 'SIG', field: 'program_classification', claimId: 'pcl1', value: 'RRH', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured' },
      { op: 'INS', field: 'program_classification', claimId: 'pcl1' },

      // Update next steps
      { op: 'SEG', field: 'agreed_next_steps', note: 'New action items after housing secured.' },
      { op: 'ALT', field: 'agreed_next_steps', claimId: 'ans2', value: 'Complete move-in. Transfer school enrollment. Set up utilities. Begin housing stabilization plan.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'declared', supersedes: 'ans1' },
      { op: 'CON', field: 'agreed_next_steps', claimId: 'ans2', supersedes: 'ans1' },

      // Update case notes
      { op: 'SEG', field: 'case_notes', note: 'Major milestone — adding housing outcome note.' },
      { op: 'ALT', field: 'case_notes', claimId: 'cn2', value: 'Housing secured through HomeStart RRH. 2BR unit in Dorchester. Rent subsidy approved for 12 months. Move-in scheduled Aug 25. Client and children excited.', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'observed', supersedes: 'cn1' },
      { op: 'CON', field: 'case_notes', claimId: 'cn2', supersedes: 'cn1' },

      // Schedule follow-up
      { op: 'SEG', field: 'next_contact_date', note: 'Post-move-in check.' },
      { op: 'ALT', field: 'next_contact_date', claimId: 'ncd3', value: '2025-09-05', agent: '@tkhan:khora.us', role: 'Caseworker', mode: 'measured', supersedes: 'ncd2' },
      { op: 'CON', field: 'next_contact_date', claimId: 'ncd3', supersedes: 'ncd2' },
    ],
  },
];

export default SEED_EVENTS;
