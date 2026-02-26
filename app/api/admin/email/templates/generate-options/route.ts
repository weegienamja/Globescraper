import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { callGemini } from "@/lib/ai/geminiClient";
import { getGenerateOptionsPrompt, type GenerateOptionsInput } from "@/lib/email/ai/prompts";
import {
  generateOptionsResponseSchema,
  blockFieldSchemas,
} from "@/lib/email/ai/schemas";
import { getTemplate } from "@/lib/email/templates/catalog";

/**
 * POST /api/admin/email/templates/generate-options
 * Ask Gemini for 3 template-based content options.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { subject, objective } = body as GenerateOptionsInput;

    if (!subject || !objective) {
      return NextResponse.json(
        { error: "subject and objective are required." },
        { status: 400 },
      );
    }

    const prompt = getGenerateOptionsPrompt(body as GenerateOptionsInput);
    const result = await callGemini(prompt);

    // Parse JSON
    let parsed: unknown;
    try {
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again.", raw: result.text },
        { status: 422 },
      );
    }

    // Validate top-level schema
    const validated = generateOptionsResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "AI response did not match expected schema.",
          details: validated.error.flatten(),
          raw: result.text,
        },
        { status: 422 },
      );
    }

    // Deep validation and sanitization
    const errors: string[] = [];
    const stripEmDash = (s: string) =>
      s.replace(/\u2014/g, ",").replace(/\u2013/g, ",").replace(/--/g, ",");

    const hasHtml = (s: string) => /<\/?[a-zA-Z]/.test(s);

    for (const option of validated.data.options) {
      // Strip em dashes from subject and preview
      option.optimizedSubject = stripEmDash(option.optimizedSubject);
      option.optimizedPreviewText = stripEmDash(option.optimizedPreviewText);

      // Validate template exists
      const template = getTemplate(option.templateId);
      if (!template) {
        errors.push(`Option ${option.id}: unknown template "${option.templateId}"`);
        continue;
      }

      // Validate block order matches recipe
      const blockTypes = option.blocks.map((b) => b.type);
      const recipe = template.blockRecipe;
      if (blockTypes.length !== recipe.length) {
        errors.push(
          `Option ${option.id}: expected ${recipe.length} blocks for "${option.templateId}", got ${blockTypes.length}`,
        );
      } else {
        for (let i = 0; i < recipe.length; i++) {
          if (blockTypes[i] !== recipe[i]) {
            errors.push(
              `Option ${option.id}: block ${i} should be "${recipe[i]}" but got "${blockTypes[i]}"`,
            );
          }
        }
      }

      // Validate each block's fields and sanitize
      for (const block of option.blocks) {
        // Sanitize string fields: strip em dashes, check for HTML
        const sanitizeFields = (obj: Record<string, unknown>) => {
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === "string") {
              obj[key] = stripEmDash(val);
              if (hasHtml(val)) {
                errors.push(
                  `Option ${option.id}, block "${block.type}": field "${key}" contains HTML tags`,
                );
              }
            } else if (Array.isArray(val)) {
              for (let i = 0; i < val.length; i++) {
                if (typeof val[i] === "string") {
                  val[i] = stripEmDash(val[i]);
                  if (hasHtml(val[i])) {
                    errors.push(
                      `Option ${option.id}, block "${block.type}": array field "${key}[${i}]" contains HTML`,
                    );
                  }
                } else if (typeof val[i] === "object" && val[i] !== null) {
                  sanitizeFields(val[i] as Record<string, unknown>);
                }
              }
            } else if (typeof val === "object" && val !== null) {
              sanitizeFields(val as Record<string, unknown>);
            }
          }
        };
        sanitizeFields(block.fields as Record<string, unknown>);

        // Validate against block's Zod schema
        const schema = blockFieldSchemas[block.type];
        if (schema) {
          const blockValid = schema.safeParse(block.fields);
          if (!blockValid.success) {
            errors.push(
              `Option ${option.id}, block "${block.type}": ${blockValid.error.issues.map((i) => i.message).join("; ")}`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "AI output has validation issues. Please try again.",
          validationErrors: errors,
          options: validated.data.options,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      options: validated.data.options,
      tokensUsed: result.tokenCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
