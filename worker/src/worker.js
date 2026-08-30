const MODEL = "gpt-5.6-sol";
const MAX_BODY_BYTES = 120000;

const tripSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "proposal"],
  properties: {
    reply: { type: "string" },
    proposal: {
      type: "object",
      additionalProperties: false,
      required: ["version", "title", "subtitle", "selectedDayId", "days"],
      properties: {
        version: { type: "integer" },
        title: { type: "string" },
        subtitle: { type: "string" },
        selectedDayId: { type: "string" },
        days: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "date", "city", "timezone", "summary", "items"],
            properties: {
              id: { type: "string" }, date: { type: "string" }, city: { type: "string" },
              timezone: { type: "string" }, summary: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "type", "title", "startTime", "endTime", "location", "origin", "destination", "travelMode", "notes"],
                  properties: {
                    id: { type: "string" },
                    type: { type: "string", enum: ["transport", "stay", "activity", "food", "note"] },
                    title: { type: "string" }, startTime: { type: "string" }, endTime: { type: "string" },
                    location: { type: "string" }, origin: { type: "string" }, destination: { type: "string" },
                    travelMode: { type: "string" }, notes: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://rubyshudl.github.io").split(",").map((item) => item.trim());
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) || local ? origin : allowed[0],
    "Access-Control-Allow-Headers": "Content-Type, X-Trip-Access",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://rubyshudl.github.io").split(",").map((item) => item.trim());
  return !origin || allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request, env) } });
}

function outputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method !== "POST") return json(request, env, { error: "Method not allowed" }, 405);
    if (!originAllowed(request, env)) return json(request, env, { error: "不允许的网页来源" }, 403);
    if (!env.OPENAI_API_KEY || !env.AI_ACCESS_CODE) return json(request, env, { error: "AI服务尚未完成配置" }, 503);
    if (request.headers.get("X-Trip-Access") !== env.AI_ACCESS_CODE) return json(request, env, { error: "私人访问码不正确" }, 401);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > MAX_BODY_BYTES) return json(request, env, { error: "行程数据过大" }, 413);

    let body;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(request, env, { error: "行程数据过大" }, 413);
      body = JSON.parse(rawBody);
    } catch { return json(request, env, { error: "请求格式不正确" }, 400); }
    if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 1200 || !body.trip || !Array.isArray(body.trip.days)) {
      return json(request, env, { error: "缺少有效的消息或行程数据" }, 400);
    }

    const instructions = `你是旅行计划编辑助手。用户会提供当前行程JSON和一条中文修改要求。\n
只处理旅行规划，不执行预订、付款或对外联系。把用户明确要求的变更反映到proposal中；未被要求的内容尽量保持不变。\n
如果信息不足，用reply简短说明需要确认的内容，proposal保持与当前行程相同。不要把估算时间写成已经确认的事实。\n
地点尽量使用Google Maps可识别的正式名称或地址。跨时区行程保留各天timezone。交通项目使用origin和destination，非交通项目使用location。\n
所有对象必须符合给定结构；新增id使用ai-加随机短字符串。reply用简体中文，说明做了什么或需要什么。`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || MODEL,
        reasoning: { effort: "low" },
        store: false,
        instructions,
        input: JSON.stringify({ request: body.message.trim(), selectedDayId: body.selectedDayId, currentTrip: body.trip }),
        text: { format: { type: "json_schema", name: "trip_edit_proposal", strict: true, schema: tripSchema } }
      })
    });

    const apiBody = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      console.error("OpenAI request failed", apiResponse.status, apiBody?.error?.type);
      return json(request, env, { error: "AI暂时无法处理，请稍后重试" }, 502);
    }
    try {
      const result = JSON.parse(outputText(apiBody));
      return json(request, env, result);
    } catch (error) {
      console.error("Invalid structured response", error);
      return json(request, env, { error: "AI返回了无法识别的修改建议" }, 502);
    }
  }
};
