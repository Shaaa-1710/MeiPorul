import { QueryResponse } from '../types/api';
import { DocumentItem } from '../types/document';
import { SystemAuditMetrics } from '../types/analytics';
import { ConversationSession } from '../types/session';

export const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc_001',
    filename: 'statutory-guidelines-dbt.pdf',
    size_bytes: 2450000,
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    state: 'READY',
    chunks_count: 142,
    category: 'Government Directives',
    description: 'Statutory directives, eligibility thresholds, age boundaries, and disbursement criteria for agricultural benefit transfers.',
    chunks: [
      {
        chunk_id: 'chk_101',
        page_number: 4,
        section_title: '1.2 Citizenship & Residence',
        token_count: 142,
        content: 'All applicants must be verified citizens of the Republic of India residing within notified rural and peri-urban agricultural districts.'
      },
      {
        chunk_id: 'chk_102',
        page_number: 5,
        section_title: '2.1 Age & Landholding Record',
        token_count: 198,
        content: 'Applicants must be between 21 and 60 years old at the date of gazette submission to qualify for direct benefit transfers. Landholding records must be seeded with verified identification.'
      },
      {
        chunk_id: 'chk_103',
        page_number: 12,
        section_title: '4.3 Scheme Exclusions',
        token_count: 165,
        content: 'Institutional landholders and beneficiaries holding constitutional posts are strictly excluded. Clause 4.3 does not detail reciprocity rules for state-level agricultural programs.'
      }
    ]
  },
  {
    id: 'doc_002',
    filename: 'finance-act-section80iac.pdf',
    size_bytes: 1820000,
    uploaded_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    state: 'READY',
    chunks_count: 96,
    category: 'Corporate Tax Code',
    description: 'Statutory rules governing tax deductions for eligible startups, entity restrictions, and turnover limits.',
    chunks: [
      {
        chunk_id: 'chk_201',
        page_number: 18,
        section_title: 'Section 80-IAC (4) Eligible Entities',
        token_count: 220,
        content: 'An eligible startup means a company or a limited liability partnership (LLP) incorporated between April 1, 2016 and March 31, 2025. Unregistered or general partnership firms are not eligible under this section regardless of turnover.'
      },
      {
        chunk_id: 'chk_202',
        page_number: 21,
        section_title: 'DPIIT Certification Mandate',
        token_count: 130,
        content: 'The entity must hold a valid Inter-Ministerial Board certificate and DPIIT recognition certificate prior to claiming deductions.'
      }
    ]
  },
  {
    id: 'doc_003',
    filename: 'clinical-protocol-nct0428966.pdf',
    size_bytes: 3120000,
    uploaded_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    state: 'READY',
    chunks_count: 210,
    category: 'Trial Protocols',
    description: 'Phase 3 randomized controlled trial protocol for therapeutic intervention, inclusion metrics, and safety markers.',
    chunks: [
      {
        chunk_id: 'chk_301',
        page_number: 9,
        section_title: '3.1 Key Inclusion Criteria',
        token_count: 185,
        content: 'Adult subjects aged 18 to 75 years presenting with persistent Stage II hypertension confirmed by 24-hour ambulatory monitoring are eligible.'
      },
      {
        chunk_id: 'chk_302',
        page_number: 10,
        section_title: '3.2 Hemodynamic Criteria',
        token_count: 140,
        content: 'Resting seated cuff blood pressure must exceed 140/90 mmHg on two separate clinic visits separated by at least 7 calendar days.'
      },
      {
        chunk_id: 'chk_303',
        page_number: 14,
        section_title: '4.1 Absolute Exclusion Criteria',
        token_count: 160,
        content: 'Pregnant or lactating female subjects are strictly excluded from trial participation due to uncharacterized teratogenicity risks.'
      }
    ]
  }
];

export const MOCK_QUERY_SCENARIO_ELIGIBILITY: QueryResponse = {
  query_id: 'q_demo_001',
  is_mock_data: true,
  model_name: 'Cascade Auditor (Evaluation)',
  timestamp: new Date().toISOString(),
  answer: 'Applicants must be Indian citizens. Applicants must be between 18 and 60 years old. Applicants should not be receiving similar benefits under other notified state schemes.',
  claims: [
    {
      claim_id: 'c_001',
      text: 'Applicants must be Indian citizens.',
      verdict: 'SUPPORTED',
      confidence: 0.99,
      verification: {
        span_check: true,
        entity_check: true,
        numeric_check: null,
        contradiction_detected: false,
        nli_required: false,
        llm_escalation: false,
        escalation_reason: 'Exact lexical span match located in statutory text.',
        compute_saved_tier: 'instant'
      },
      evidence: [
        {
          document_id: 'doc_001',
          document_name: 'statutory-guidelines-dbt.pdf',
          page: 4,
          section: '1.2 Citizenship & Residence',
          text: 'All applicants must be verified citizens of the Republic of India residing within notified rural and peri-urban agricultural districts.',
          highlight: 'verified citizens of the Republic of India',
          citation_id: 'CIT-01',
          similarity_score: 0.96
        }
      ]
    },
    {
      claim_id: 'c_002',
      text: 'Applicants must be between 18 and 60 years old.',
      verdict: 'CONTRADICTED',
      confidence: 0.98,
      verification: {
        span_check: false,
        entity_check: true,
        numeric_check: false,
        contradiction_detected: true,
        nli_required: false,
        llm_escalation: false,
        escalation_reason: 'Contradiction detected at numeric check: candidate response asserts age 18, whereas retrieved official statutory guideline requires age 21.',
        compute_saved_tier: 'cheap_heuristic'
      },
      evidence: [
        {
          document_id: 'doc_001',
          document_name: 'statutory-guidelines-dbt.pdf',
          page: 5,
          section: '2.1 Age & Landholding Record',
          text: 'Applicants must be between 21 and 60 years old at the date of gazette submission to qualify for direct benefit transfers.',
          highlight: 'between 21 and 60 years old',
          citation_id: 'CIT-02',
          similarity_score: 0.94
        }
      ]
    },
    {
      claim_id: 'c_003',
      text: 'Applicants should not be receiving similar benefits under other notified state schemes.',
      verdict: 'UNCERTAIN',
      confidence: 0.54,
      verification: {
        span_check: false,
        entity_check: true,
        numeric_check: null,
        contradiction_detected: false,
        nli_required: true,
        nli_confidence: 0.54,
        llm_escalation: false,
        escalation_reason: 'Evidence does not provide enough information to confidently verify this claim. Clause 4.3 notes exclusions for institutional landholders but omits reciprocity guidelines for state-level schemes.',
        compute_saved_tier: 'small_nli'
      },
      evidence: [
        {
          document_id: 'doc_001',
          document_name: 'statutory-guidelines-dbt.pdf',
          page: 12,
          section: '4.3 Scheme Exclusions',
          text: 'Institutional landholders and beneficiaries holding constitutional posts are strictly excluded. Clause 4.3 does not detail reciprocity rules for state-level agricultural programs.',
          highlight: 'does not detail reciprocity rules for state-level agricultural programs',
          citation_id: 'CIT-03',
          similarity_score: 0.81
        }
      ]
    }
  ],
  metrics: {
    latency_ms: 480,
    claims_count: 3,
    llm_escalations: 0,
    cache_hits: 1
  }
};

export const MOCK_QUERY_SCENARIO_TAX: QueryResponse = {
  query_id: 'q_demo_002',
  is_mock_data: true,
  model_name: 'Cascade Auditor (Evaluation)',
  timestamp: new Date().toISOString(),
  answer: 'Partnership firms qualify for Section 80-IAC three-year tax holiday if their annual turnover is under ₹100 Crore. The entity must hold a valid DPIIT recognition certificate.',
  claims: [
    {
      claim_id: 'c_004',
      text: 'Partnership firms qualify for Section 80-IAC three-year tax holiday if their annual turnover is under ₹100 Crore.',
      verdict: 'CONTRADICTED',
      confidence: 0.94,
      verification: {
        span_check: false,
        entity_check: false,
        numeric_check: true,
        contradiction_detected: true,
        nli_required: true,
        nli_confidence: 0.92,
        llm_escalation: true,
        llm_reasoning: 'Legal entity restriction violated. Section 80-IAC(4) restricts eligible entities to incorporated Companies and LLPs. Unregistered or general partnership firms are expressly excluded.',
        escalation_reason: 'Entity type mismatch escalated to resolve statutory definition ambiguity.',
        compute_saved_tier: 'expensive_llm'
      },
      evidence: [
        {
          document_id: 'doc_002',
          document_name: 'finance-act-section80iac.pdf',
          page: 18,
          section: 'Section 80-IAC (4) Eligible Entities',
          text: 'An eligible startup means a company or a limited liability partnership (LLP) incorporated between April 1, 2016 and March 31, 2025. Unregistered or general partnership firms are not eligible under this section regardless of turnover.',
          highlight: 'Unregistered or general partnership firms are not eligible',
          citation_id: 'CIT-04',
          similarity_score: 0.93
        }
      ]
    },
    {
      claim_id: 'c_005',
      text: 'The entity must hold a valid DPIIT recognition certificate.',
      verdict: 'SUPPORTED',
      confidence: 0.99,
      verification: {
        span_check: true,
        entity_check: true,
        numeric_check: null,
        contradiction_detected: false,
        nli_required: false,
        llm_escalation: false,
        escalation_reason: 'Exact entity certification match verified in statutory guidance.',
        compute_saved_tier: 'instant'
      },
      evidence: [
        {
          document_id: 'doc_002',
          document_name: 'finance-act-section80iac.pdf',
          page: 21,
          section: 'DPIIT Certification Mandate',
          text: 'The entity must hold a valid Inter-Ministerial Board certificate and DPIIT recognition certificate prior to claiming deductions.',
          highlight: 'DPIIT recognition certificate prior to claiming deductions',
          citation_id: 'CIT-05',
          similarity_score: 0.97
        }
      ]
    }
  ],
  metrics: {
    latency_ms: 1140,
    claims_count: 2,
    llm_escalations: 1,
    cache_hits: 0
  }
};

export const MOCK_QUERY_SCENARIO_CLINICAL: QueryResponse = {
  query_id: 'q_demo_003',
  is_mock_data: true,
  model_name: 'Cascade Auditor (Evaluation)',
  timestamp: new Date().toISOString(),
  answer: 'Adult subjects aged 18 to 75 presenting with confirmed Stage II hypertension are eligible for trial enrollment. Blood pressure must exceed 140/90 mmHg at both screening visits. Pregnant or lactating individuals are eligible under supervised monitoring.',
  claims: [
    {
      claim_id: 'c_006',
      text: 'Adult subjects aged 18 to 75 presenting with confirmed Stage II hypertension are eligible for trial enrollment.',
      verdict: 'PARTIALLY_SUPPORTED',
      confidence: 0.86,
      verification: {
        span_check: false,
        entity_check: true,
        numeric_check: true,
        contradiction_detected: false,
        nli_required: true,
        nli_confidence: 0.86,
        llm_escalation: false,
        escalation_reason: 'Age range (18-75) aligns, but protocol requires confirmation specifically via 24-hour ambulatory monitoring.',
        compute_saved_tier: 'small_nli'
      },
      evidence: [
        {
          document_id: 'doc_003',
          document_name: 'clinical-protocol-nct0428966.pdf',
          page: 9,
          section: '3.1 Key Inclusion Criteria',
          text: 'Adult subjects aged 18 to 75 years presenting with persistent Stage II hypertension confirmed by 24-hour ambulatory monitoring are eligible.',
          highlight: 'confirmed by 24-hour ambulatory monitoring',
          citation_id: 'CIT-06',
          similarity_score: 0.89
        }
      ]
    },
    {
      claim_id: 'c_007',
      text: 'Blood pressure must exceed 140/90 mmHg at both screening visits.',
      verdict: 'SUPPORTED',
      confidence: 0.97,
      verification: {
        span_check: true,
        entity_check: true,
        numeric_check: true,
        contradiction_detected: false,
        nli_required: false,
        llm_escalation: false,
        escalation_reason: 'Numeric threshold and screening interval corroborated in section 3.2.',
        compute_saved_tier: 'instant'
      },
      evidence: [
        {
          document_id: 'doc_003',
          document_name: 'clinical-protocol-nct0428966.pdf',
          page: 10,
          section: '3.2 Hemodynamic Criteria',
          text: 'Resting seated cuff blood pressure must exceed 140/90 mmHg on two separate clinic visits separated by at least 7 calendar days.',
          highlight: 'must exceed 140/90 mmHg on two separate clinic visits',
          citation_id: 'CIT-07',
          similarity_score: 0.95
        }
      ]
    },
    {
      claim_id: 'c_008',
      text: 'Pregnant or lactating individuals are eligible under supervised monitoring.',
      verdict: 'CONTRADICTED',
      confidence: 0.99,
      verification: {
        span_check: false,
        entity_check: true,
        numeric_check: null,
        contradiction_detected: true,
        nli_required: false,
        llm_escalation: false,
        escalation_reason: 'Direct contradiction: Protocol section 4.1 specifies pregnancy as an absolute exclusion criterion.',
        compute_saved_tier: 'cheap_heuristic'
      },
      evidence: [
        {
          document_id: 'doc_003',
          document_name: 'clinical-protocol-nct0428966.pdf',
          page: 14,
          section: '4.1 Absolute Exclusion Criteria',
          text: 'Pregnant or lactating female subjects are strictly excluded from trial participation due to uncharacterized teratogenicity risks.',
          highlight: 'Pregnant or lactating female subjects are strictly excluded',
          citation_id: 'CIT-08',
          similarity_score: 0.97
        }
      ]
    }
  ],
  metrics: {
    latency_ms: 710,
    claims_count: 3,
    llm_escalations: 0,
    cache_hits: 1
  }
};

export const INITIAL_CONVERSATION_SESSIONS: ConversationSession[] = [
  {
    id: 'conv_today_1',
    title: 'Statutory eligibility criteria & age limits',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    selectedDocumentIds: ['doc_001'],
    messages: [
      {
        id: 'msg_u_001',
        role: 'user',
        content: 'What are the statutory eligibility criteria, age limits, and scheme exclusions for the direct benefit transfer program?',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'msg_a_001',
        role: 'assistant',
        content: MOCK_QUERY_SCENARIO_ELIGIBILITY.answer,
        timestamp: new Date(Date.now() - 3600000 * 2 + 800).toISOString(),
        claims: MOCK_QUERY_SCENARIO_ELIGIBILITY.claims,
        metrics: MOCK_QUERY_SCENARIO_ELIGIBILITY.metrics,
        isAudited: true,
        isMock: true
      }
    ]
  },
  {
    id: 'conv_today_2',
    title: 'Section 80-IAC tax holiday for partnerships',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    selectedDocumentIds: ['doc_002'],
    messages: [
      {
        id: 'msg_u_002',
        role: 'user',
        content: 'Can a software venture claim Section 80-IAC tax exemption if organized as a partnership firm?',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 'msg_a_002',
        role: 'assistant',
        content: MOCK_QUERY_SCENARIO_TAX.answer,
        timestamp: new Date(Date.now() - 3600000 * 5 + 1100).toISOString(),
        claims: MOCK_QUERY_SCENARIO_TAX.claims,
        metrics: MOCK_QUERY_SCENARIO_TAX.metrics,
        isAudited: true,
        isMock: true
      }
    ]
  },
  {
    id: 'conv_yesterday_1',
    title: 'Clinical trial NCT0428966 inclusion criteria',
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    selectedDocumentIds: ['doc_003'],
    messages: [
      {
        id: 'msg_u_003',
        role: 'user',
        content: 'What are the patient screening requirements and exclusions for Trial NCT0428966?',
        timestamp: new Date(Date.now() - 3600000 * 26).toISOString()
      },
      {
        id: 'msg_a_003',
        role: 'assistant',
        content: MOCK_QUERY_SCENARIO_CLINICAL.answer,
        timestamp: new Date(Date.now() - 3600000 * 26 + 950).toISOString(),
        claims: MOCK_QUERY_SCENARIO_CLINICAL.claims,
        metrics: MOCK_QUERY_SCENARIO_CLINICAL.metrics,
        isAudited: true,
        isMock: true
      }
    ]
  }
];

export const MOCK_SYSTEM_METRICS: SystemAuditMetrics = {
  isMockData: true,
  totalQueries: 124,
  totalClaims: 388,
  supportedClaims: 248,
  contradictedClaims: 64,
  partiallySupportedClaims: 42,
  uncertainClaims: 26,
  notEntailedClaims: 8,
  averageConfidence: 0.93,
  averageLatencyMs: 560,
  cascadeEfficiencyRate: 0.912,
  nliEscalationRate: 0.14,
  llmEscalationRate: 0.088,
  cacheHitRate: 0.28,
  breakdownByMethod: {
    exactSpanMatches: 182,
    entityMatches: 84,
    numericContradictions: 56,
    nliResolutions: 32,
    llmEscalations: 34
  },
  recentAudits: [
    {
      id: 'aud_01',
      query: 'Statutory eligibility criteria & age limits',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      verdictDistribution: { SUPPORTED: 1, CONTRADICTED: 1, UNCERTAIN: 1 },
      escalated: false,
      latencyMs: 480
    },
    {
      id: 'aud_02',
      query: 'Section 80-IAC tax holiday for partnerships',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      verdictDistribution: { CONTRADICTED: 1, SUPPORTED: 1 },
      escalated: true,
      latencyMs: 1140
    },
    {
      id: 'aud_03',
      query: 'Clinical trial NCT0428966 inclusion criteria',
      timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
      verdictDistribution: { PARTIALLY_SUPPORTED: 1, SUPPORTED: 1, CONTRADICTED: 1 },
      escalated: false,
      latencyMs: 710
    }
  ]
};
