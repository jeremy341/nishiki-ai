import { callModel } from "./ai.js";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import { roleConfigured } from "./providers.js";
import { activityLabel, runTool, toolSpecs } from "./tools.js";

const MAX_STEPS = 6;

// Smaller, faster models sometimes say they did something ("ich erinnere dich", "ich trag's ein") without
// calling the tool that does it. That is a lie the person would only find out about too late, so such an
// answer is sent back once with the instruction to call the tool.
const ACTION_TOOLS = ["set_reminder", "calendar_add", "save_note", "schedule_task", "remember", "todoist_add_task"];
const CLAIM = [
  /\bich\s+(erinnere\s+dich|trag(e|['’]s)\b[^.!?]{0,40}\bein|notiere\b|speichere\b|merke\s+(es|das)\s+vor)/i,
  /\bich\s+(habe|hab)\s+(dir\s+)?[^.!?]{0,50}(erinnerung|eingetragen|notiert|gespeichert|vorgemerkt|angelegt|eingerichtet|gesetzt)/i,
  /\btrag['’]?s\s+(dir\s+)?ein\b/i,
  /\b(ist|wurde)\s+(eingetragen|notiert|gespeichert|eingerichtet|angelegt)\b/i,
  /\bi('ll|\s+will|'ve|\s+have)\s+(set|add|added|saved|noted|remind)/i,
];
const claimsAnAction = (text) => CLAIM.some((pattern) => pattern.test(text));

// Lets the model call tools until it has an answer. Tool results go back to the model;
// the final text is what the user sees.
export async function runAgent(messages, ctx) {
  const tools = toolSpecs(ctx);
  const working = [...messages];
  const budget = { used: 0 };
  let usedTool = false;
  let corrected = false;
  let emptyRetries = 0;
  const canAct = tools.some((tool) => ACTION_TOOLS.includes(tool.function.name));

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (budget.used > config.ai.maxTurnTokens) {
      throw new AppError(502, "That answer needed too much work. Ask for a smaller part.");
    }
    const message = await callModel(working, { role: ctx.voice && roleConfigured("voice") ? "voice" : "chat", userId: ctx.userId, tools: tools.length ? tools : undefined, budget,
      onText: ctx.onText,
      // Spoken answers are short because the prompt says so; the limit must still leave room for a tool call's arguments.
      ...(ctx.voice ? { maxTokens: Math.max(1200, config.voice.maxTokens) } : {}) });
    const calls = message.tool_calls || [];

    if (!calls.length) {
      if (!message.content) {
        // Some models now and then end with nothing at all; asking again almost always works.
        if (emptyRetries < 1) {
          emptyRetries += 1;
          continue;
        }
        throw new AppError(502, "The AI returned an empty answer.");
      }
      if (canAct && !usedTool && !corrected && claimsAnAction(message.content)) {
        corrected = true;
        working.push({ role: "assistant", content: message.content });
        working.push({
          role: "user",
          content: "(System note: you said you did it, but no tool was called, so nothing happened. Call the right tool now (set_reminder, calendar_add, save_note or schedule_task) with the details from the conversation. If you only meant to offer it, answer again in one sentence and do not say it is done.)",
        });
        ctx.onReset?.();
        continue;
      }
      return message.content;
    }

    // Words said before a tool call are not part of the final answer; the page clears them.
    ctx.onReset?.();
    working.push({ role: "assistant", content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name || "";
      usedTool = true;
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
