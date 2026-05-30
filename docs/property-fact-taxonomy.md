# HomeTruth Property Fact Taxonomy

**Tracking ticket:** HT-313  
**Status:** Initial insurer-pilot taxonomy  
**Last updated:** 2026-05-30

## Objective

Keep the first `property_facts` implementation narrow enough to verify with a 500-user insurer cohort while preserving a graph-ready path for future HomeTruth domain expansion.

## Initial Fact Keys

| Fact key | Intended use | Example value payload |
| --- | --- | --- |
| `maintenance.last_service_date` | Last known maintenance/service date for a component or system. | `{ "date": "2026-01-15", "system": "boiler" }` |
| `maintenance.next_service_due` | Next known or suggested maintenance due date. | `{ "date": "2027-01-15", "system": "boiler" }` |
| `compliance.certificate_expiry` | Expiry date for an insurance-relevant certificate or compliance record. | `{ "date": "2026-12-31", "certificateType": "gas_safety" }` |
| `insurance.policy_expiry` | Home insurance policy expiry or renewal date. | `{ "date": "2026-10-01", "provider": "Zurich" }` |
| `risk.known_issue` | Known risk, defect or issue that may affect prevention or claim severity. | `{ "issue": "damp", "location": "rear wall", "severity": "medium" }` |
| `repair.repair_event` | Completed or reported repair/maintenance event. | `{ "date": "2026-03-20", "work": "gutter cleared", "cost": 120 }` |

## Verification Rules

- Manual and system facts can be stored as `user_confirmed` or another explicit non-suggested status when appropriate.
- AI and OCR-created facts must start with `verification_status = suggested`.
- Document-derived facts should reference an `evidence_sources` record where possible.
- Older facts must not be deleted or overwritten. A new current fact can mark the previous fact with the same namespace/type as not current, while preserving the row.

## Deferred Decisions

- Do not create dedicated maintenance, certificate, risk or insurance tables until pilot usage proves lifecycle and reporting needs.
- Do not add a many-to-many fact/evidence table yet. The first implementation uses `property_facts.evidence_source_id`.
- Do not automate broad document extraction in this ticket. Controlled API creation and suggested fact support come first.
