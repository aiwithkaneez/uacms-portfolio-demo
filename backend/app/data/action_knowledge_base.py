"""
Small structured "next steps" list per category, for the suggestion panel to
show alongside the retrieved policy text.

Every entry here is a short paraphrase of a real clause already in
app/data/policy_corpus.py — nothing here is invented or LLM-generated. Each
entry cites the exact source clause it's paraphrasing, and the panel labels
this whole section "Recommended System Workflow" rather than "Policy
Requirement" for a reason: this is UACMS's own summary of the procedure, not
a verbatim quote. The verbatim policy text is still shown separately (via
policy_corpus.py) so a desk owner can always check the paraphrase against
the real clause.

No entry exists for "general" — same reason no policy corpus exists for it
(app/data/policy_corpus.py docstring): there's no HR policy document to
paraphrase a procedure from. The suggestion panel shows
"No specific procedure found in the available policy documents" instead of
inventing a generic workflow, per the same reasoning that kept an AI
suggestion engine from ever fabricating an action it can't source.
"""

ACTION_KNOWLEDGE_BASE: dict[str, list[dict[str, str]]] = {
    "harassment": [
        {"title": "Acknowledge and review the complaint", "source": "Harassment Policy — Lodging Complaint of Harassment (10.1-10.2)"},
        {"title": "Refer the matter to the Inquiry Committee", "source": "Harassment Policy — Procedure for Holding Inquiry (11.1-11.4)"},
        {"title": "Communicate the charges to the accused within 3 days", "source": "Harassment Policy — Procedure for Holding Inquiry (11.1-11.4)"},
        {"title": "Document findings and recommend a decision within 30 days", "source": "Harassment Policy — Procedure for Holding Inquiry (11.1-11.4)"},
    ],
    "whistleblow": [
        {"title": "Acknowledge the report within 5 working days", "source": "Whistleblower Protection Policy — Handling of Whistle Blow Cases"},
        {"title": "Conduct an initial inquiry within 10 working days", "source": "Whistleblower Protection Policy — Handling of Whistle Blow Cases"},
        {"title": "Forward to the Fraud Investigation Unit (FIU) if corroborated", "source": "Whistleblower Protection Policy — Handling of Whistle Blow Cases"},
    ],
    "grievance": [
        {"title": "Discuss the issue with the employee's immediate supervisor", "source": "Grievance Resolution Policy — Stage 1: Employee to Supervisor"},
        {"title": "Escalate to the supervisor's manager if unresolved", "source": "Grievance Resolution Policy — Stage 2: Supervisor's Manager"},
        {"title": "Escalate to CHRO / Human Resource Committee if still unresolved", "source": "Grievance Resolution Policy — Stage 3: CHRO / Human Resource Committee"},
    ],
}


def get_recommended_workflow(category: str) -> list[dict[str, str]]:
    return ACTION_KNOWLEDGE_BASE.get(category, [])
