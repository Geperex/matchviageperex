// netlify/edge-functions/analyze.js
// Edge Function con streaming — sin límite de tiempo, respuesta rápida

export default async (request, context) => {
  // CORS preflight
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
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada en variables de entorno." }),
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

  // Limitar max_tokens para acelerar respuesta
  if (!body.max_tokens || body.max_tokens > 2000) {
    body.max_tokens = 2000
  }

  // Usar streaming de Anthropic para no acumular toda la respuesta en memoria
  // y evitar timeouts en conexiones lentas
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "messages-2023-12-15",
    },
    body: JSON.stringify({
      ...body,
      stream: false, // Sin streaming — más simple y compatible
    }),
  })

  // Pasar la respuesta directamente sin buffering adicional
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
