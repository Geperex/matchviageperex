// netlify/edge-functions/analyze.js
export default async (request, context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada." }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Request body inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }

  // Construir payload limpio para Anthropic
  const payload = {
    model:      body.model || "claude-haiku-4-5-20251001",
    max_tokens: Math.min(body.max_tokens || 1200, 4000),
    messages:   body.messages,
  }
  if (body.system) payload.system = body.system

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-api-key":       apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  })

  const data = await anthropicRes.json()

  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  })
}
