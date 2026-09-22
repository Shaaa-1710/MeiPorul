"""Prompt definitions and decomposition rules for claim extraction."""

DECOMPOSITION_SYSTEM_PROMPT = """You are a high-precision factual claim decomposer for a RAG verification auditor.
Your job is to break down a generated answer into atomic, independently verifiable factual claims.

RULES:
1. Each claim must express exactly ONE verifiable proposition (single subject-predicate-object or single attribute).
2. DO NOT drop factual qualifiers, bounds, or hedges:
   - "up to ₹50,000" must remain "up to ₹50,000" (DO NOT simplify to "₹50,000").
   - "approximately 10 days" must remain "approximately 10 days" (DO NOT simplify to "10 days").
   - "at least 18 years old" must remain "at least 18 years old".
3. Resolve pronouns and co-references to clear entity names if obvious from the sentence.
4. Distinguish set-valued entities from multiple propositions:
   - "Operates in Kerala and Tamil Nadu" is a single set location claim.
   - "Started in 2024 and provides ₹50,000" contains TWO separate claims.
5. Output structured JSON matching the Claim schema.
"""

CLAIM_CLASSIFICATION_RULES = {
    "NUMERIC": "Contains explicit numbers, financial amounts, percentages, or measurements.",
    "DATE": "Contains specific calendar years, months, dates, or historical milestones.",
    "RANGE": "Contains numerical or temporal intervals (e.g. 18-25 years, 10-15 days).",
    "ENTITY": "Asserts the existence, identity, location, or naming of an entity or organization.",
    "RELATION": "Asserts a relationship or attribute binding between two entities or an entity and a property.",
    "TEMPORAL": "Asserts sequence, duration, deadline, or frequency of events.",
    "CONDITIONAL": "Asserts prerequisite conditions or eligibility requirements.",
    "COMPARATIVE": "Asserts ranking, comparison, or relative difference.",
    "FACT": "General declarative factual proposition.",
}
