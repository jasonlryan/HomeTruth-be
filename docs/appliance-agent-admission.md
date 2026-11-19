# Appliance lookup admission

The appliance HTTP routes require HT_APPLIANCE_ITEMS_ENABLED=true. Typed Ask offers require HT356_ASK_MANUAL_HANDOFF=true. Both default off.

Apply the Sequelize migration before starting the updated backend. Use the same configuration on every instance. Drain older instances before opening paid admission. A restart loads the selected revision and limits. Existing authorised reviews, confirmed imports and request-key replays remain available when admission is disabled.

| Backend environment variable | Meaning |
| --- | --- |
| APPLIANCE_AGENT_ENABLED | Defaults to false. Set to true to admit fresh runs. |
| APPLIANCE_AGENT_REVISION | Registered revision for new runs. Defaults to 1. |
| APPLIANCE_AGENT_BUDGET_CURRENCY | Deployment market currency. GBP is the approved UK pilot default. EUR and USD are recognised and inactive. Client locale and property selection never set this value. |
| APPLIANCE_AGENT_MAX_CONCURRENT | UK default and ceiling of one running lookup per homeowner across items and workers. |
| APPLIANCE_AGENT_DAILY_MICROS | UK default and ceiling of 1,000,000 GBP micros (£1) per homeowner per UTC day. |
| APPLIANCE_AGENT_LOOKUP_MICROS | UK pilot reserves 200,000 GBP micros (20p) per paid lookup. |
| APPLIANCE_AGENT_MAX_TURNS | Optional lower limit, up to four model turns. |
| APPLIANCE_AGENT_MAX_TOOL_CALLS | Optional lower limit, up to three hosted tool calls per model response. |
| APPLIANCE_AGENT_MAX_OUTPUT_TOKENS | Optional lower limit, up to 2,500 tokens per response. |
| APPLIANCE_AGENT_DEADLINE_MS | Optional shorter SDK deadline, up to 90,000 milliseconds. |

The spend ledger counts reserved allocations. Actual provider prices, input sizes and usage can produce a different invoice. A reservation and its run commit together. A paid attempt consumes its allocation even when the provider times out or access changes. Replays and unsupported-manufacturer fallbacks cost zero additional allocation. The daily ledger survives appliance deletion. Available provider usage is recorded separately.

A completed or failed lookup releases its concurrency slot. An abandoned running row stops counting after the existing three-minute interruption window. A repeat with the same request key returns the prior run. A deliberate new attempt uses a new key. Pre-migration runs use the revision 1 reader. A revision rollback must keep the readers for all persisted revisions registered.

The daily ledger has one row per homeowner per UTC day. Existing unlabelled daily balances migrate as USD. If an existing balance has a different currency, paid admission resumes on the next UTC day. Legacy run snapshots with a reservation and no currency also represent USD. Apply both migrations before rollout. Keep the currency-aware schema and disable admission if rolling back the application while local-currency balances exist.

HomeTruth funds the pilot. A reservation creates no customer charge or subscription debit. Each run's private usage record separately stores the provider, model, input/cached/output token counts, hosted web searches and an estimated cost in USD micros. The estimate uses the standard GPT-5 mini rate card verified on 19 November 2026. Other models retain usage with an unknown estimate. A failure can incur provider costs even when usage is unavailable. Use the provider invoice to reconcile actual expenditure. No foreign exchange conversion is needed for admission.

Pricing sources are the [GPT-5 mini model rates](https://developers.openai.com/api/docs/models/gpt-5-mini) and [web search rates](https://developers.openai.com/api/docs/pricing).
