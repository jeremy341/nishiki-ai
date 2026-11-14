import { callModel } from "./ai.js";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import { activityLabel, runTool, toolSpecs } from "./tools.js";

const MAX_STEPS = 6;

// Lets the model call tools until it has an answer. Tool results go back to the model;
// the final text is what the user sees.
export async function runAgent(messages, ctx) {
  const tools = toolSpecs(ctx);
  const working = [...messages];
  const budget = { used: 0 };

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (budget.used > config.ai.maxTurnTokens) {
      throw new AppError(502, "That answer needed too much work. Ask for a smaller part.");
    }
    const message = await callModel(working, { role: "chat", userId: ctx.userId, tools: tools.length ? tools : undefined, budget,
      onText: ctx.onText,
      ...(ctx.voice ? { effort: "low", maxTokens: 450 } : {}) });
    const calls = message.tool_calls || [];

    if (!calls.length) {
      if (!message.content) throw new AppError(502, "The AI returned an empty answer.");
      return message.content;
    }

    // Words said before a tool call are not part of the final answer; the page clears them.
    ctx.onReset?.();
    working.push({ role: "assistant", content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name || "";
      let result;
      try {
        const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        result = await runTool(name, args, ctx);
      } catch (error) {
        if (error instanceof AppError) {
          result = { error: error.message };
        } else {
          console.warn("Tool failed:", name, error.name);
          result = { error: "That tool could not finish. Tell the user and offer another way." };
        }
      }
      // The user sees a short summary of what was used, never the raw result.
      const label = result.error ? null : activityLabel(name, ctx);
      if (label && !ctx.activity.includes(label)) ctx.activity.push(label);
      working.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, config.ai.toolOutputChars),
      });
    }
  }
  throw new AppError(502, "That took too many steps. Try asking in a simpler way.");
}
