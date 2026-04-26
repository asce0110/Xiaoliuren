import { NextRequest } from "next/server";
import type { DivineResult } from "@/lib/divine";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
// 默认使用 V4 旗舰；可通过 DEEPSEEK_MODEL 环境变量切换为 deepseek-v4-flash
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";

interface AnalyzeBody {
  result: DivineResult;
  question?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      "[ERROR] 服务端未配置 DEEPSEEK_API_KEY，请在 .env.local 中填入密钥后重启。",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return new Response("[ERROR] 请求体非法 JSON。", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!body?.result?.board?.length) {
    return new Response("[ERROR] 缺少排盘结果。", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(body.result, body.question);

  const upstream = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: true,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: req.signal,
  }).catch((e: unknown) => {
    return new Response(`[ERROR] 调用 DeepSeek 失败：${(e as Error).message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });

  if (upstream instanceof Response && upstream.headers.get("Content-Type")?.startsWith("text/plain")) {
    return upstream;
  }
  if (!(upstream instanceof Response)) {
    return new Response("[ERROR] 未知上游响应。", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(`[ERROR] DeepSeek 返回 ${upstream.status}：${text.slice(0, 500)}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const rawLine = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!rawLine.startsWith("data:")) continue;
            const data = rawLine.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta: string | undefined = json?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ignore parse errors mid-stream
            }
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`\n[ERROR] 流式中断：${(e as Error).message}`)
        );
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
