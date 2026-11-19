// OpenAI standard rates checked 2026-11-19. Units below are millionths of USD.
module.exports = function providerCost(model, responses) {
  let inputTokens = 0, cachedInputTokens = 0, outputTokens = 0, searchCalls = 0;
  let complete = responses.length > 0;
  for (const response of responses) {
    const usage = response.usage;
    if (!(usage?.totalTokens > 0) || !Number.isInteger(usage.inputTokens) || !Number.isInteger(usage.outputTokens)) complete = false;
    inputTokens += usage?.inputTokens ?? 0;
    outputTokens += usage?.outputTokens ?? 0;
    for (const detail of usage?.inputTokensDetails ?? []) cachedInputTokens += detail.cached_tokens ?? 0;
    for (const item of response.output ?? []) {
      if (item.type === 'hosted_tool_call' && item.name === 'web_search_call') searchCalls++;
    }
  }
  const priced = ['gpt-5-mini', 'gpt-5-mini-2025-08-07'].includes(model);
  const estimatedMicros = complete && priced ? Math.round(
    (inputTokens - cachedInputTokens) * 0.25 + cachedInputTokens * 0.025 + outputTokens * 2 + searchCalls * 10000
  ) : null;
  return { provider:'openai', model, currency:'USD', rateDate: priced ? '2026-11-19' : null,
    inputTokens, cachedInputTokens, outputTokens, searchCalls, estimatedMicros };
};
