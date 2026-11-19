# Appliance lookup admission

Apply the Sequelize migration before starting the updated backend. Use the same configuration on every instance. Drain older instances before opening paid admission. A restart loads the selected revision and limits. Existing authorised reviews, confirmed imports and request-key replays remain available when admission is disabled.

| Backend environment variable | Meaning |
| --- | --- |
| APPLIANCE_AGENT_ENABLED | Defaults to false. Set to true to admit fresh runs. |
| APPLIANCE_AGENT_REVISION | Registered revision for new runs. Defaults to 1. |
| APPLIANCE_AGENT_MAX_CONCURRENT | Required positive integer when enabled. Counts running lookups for each principal across items and backend workers. |
| APPLIANCE_AGENT_DAILY_USD_MICROS | Required daily allocation per principal, in millionths of one US dollar. The day begins at midnight UTC. |
| APPLIANCE_AGENT_LOOKUP_USD_MICROS | Required allocation for each paid lookup. Must fit the daily allowance. Agree a conservative allocation for the chosen model, tools and execution limits before enabling. |
| APPLIANCE_AGENT_MAX_TURNS | Optional lower limit, up to four model turns. |
| APPLIANCE_AGENT_MAX_TOOL_CALLS | Optional lower limit, up to three hosted tool calls per model response. |
| APPLIANCE_AGENT_MAX_OUTPUT_TOKENS | Optional lower limit, up to 2,500 tokens per response. |
| APPLIANCE_AGENT_DEADLINE_MS | Optional shorter SDK deadline, up to 90,000 milliseconds. |

The spend ledger counts reserved allocations. Actual provider prices, input sizes and usage can produce a different invoice. A reservation and its run commit together. A paid attempt consumes its allocation even when the provider times out or access changes. Replays and unsupported-manufacturer fallbacks cost zero additional allocation. The daily ledger survives appliance deletion. Available provider usage is recorded separately.

A completed or failed lookup releases its concurrency slot. An abandoned running row stops counting after the existing three-minute interruption window. A repeat with the same request key returns the prior run. A deliberate new attempt uses a new key. Pre-migration runs use the revision 1 reader. A revision rollback must keep the readers for all persisted revisions registered.

Pilot concurrency, daily allowance and per-lookup allocation await owner approval.
