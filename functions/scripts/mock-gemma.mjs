// A tiny stand-in for the Gemini API, so the assistant's tool-calling path can be
// exercised locally without model credits. It reads the same request the
// `assistantGenerate` function sends and answers like a well-behaved Gemma:
// an amount + currency becomes a get_quote call, tool results become one short
// sentence, and anything else is asked back.
//
//   node scripts/mock-gemma.mjs            # listens on :9400
//   echo 'GEMINI_BASE_URL=http://localhost:9400/v1beta' >> functions/.env.local
import {createServer} from "node:http";

const PORT = Number(process.env.PORT ?? 9400);

const CURRENCY = [
    ["BRL", /\b(brl|reais|reales|real|r\$)/i],
    ["PEN", /\b(pen|soles?|s\/)/i],
    ["USD", /\b(usd|d[oó]lares?|dollars?)/i],
];

const lastText = (contents) => {
    for (let i = contents.length - 1; i >= 0; i -= 1) {
        const part = contents[i].parts.find((p) => typeof p.text === "string");
        if (contents[i].role === "user" && part) return part.text;
    }
    return "";
};

const reply = (body) => {
    const {contents, systemInstruction} = body;
    const last = contents.at(-1);
    const language = /Spanish/.test(systemInstruction?.parts?.[0]?.text ?? "") ? "es" : "en";
    const say = (es, en) => ({parts: [{text: language === "es" ? es : en}]});

    // Right after a tool ran: one short sentence, no numbers.
    const response = last.parts.find((p) => p.functionResponse)?.functionResponse;
    if (response) {
        const {status, next_missing_field: next, complete} = response.response;
        if (status === "quote_shown") return say("Listo. ¿Continuamos?", "Done. Shall we continue?");
        if (status === "invalid") return say("Ese dato no parece válido. ¿Me lo repites?", "That doesn't look valid. Can you repeat it?");
        if (status === "saved" && complete) return say("Perfecto, revisa tu operación.", "Great, please review your order.");
        if (status === "saved") return say(`Gracias. ¿Me das tu ${next}?`, `Thanks. What is your ${next}?`);
        if (status === "handed_off") return say("Te paso con una persona del equipo.", "Handing you to a person.");
        if (status === "order_shown") return say("Aquí está el estado de tu operación.", "Here is your order status.");
        return say("Listo.", "Done.");
    }

    const text = lastText(contents);
    const amount = /\d[\d.,]*/.exec(text);
    const found = CURRENCY.filter(([, re]) => re.test(text)).map(([code]) => code);
    if (amount && found.length > 0) {
        const send = found[0];
        const receive = found[1] ?? (send === "PEN" ? "BRL" : "PEN");
        return {
            parts: [
                {
                    functionCall: {
                        name: "get_quote",
                        args: {amount: Number(amount[0].replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")), send_currency: send, receive_currency: receive},
                    },
                },
            ],
        };
    }
    if (/persona|human|agente|asesor/i.test(text)) {
        return {parts: [{functionCall: {name: "request_human", args: {reason: "asked for a person"}}}]};
    }
    if (/d[oó]nde|status|estado|order/i.test(text)) {
        return {parts: [{functionCall: {name: "get_order_status", args: {}}}]};
    }
    if (/^\s*\d{8}\s*$/.test(text) || /@/.test(text)) {
        const field = /@/.test(text) ? "email" : "docNumber";
        return {parts: [{functionCall: {name: "save_client_data", args: {field, value: text.trim()}}}]};
    }
    return say("¿Cuánto quieres enviar y a qué país?", "How much do you want to send, and to which country?");
}

createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
        try {
            const body = JSON.parse(raw);
            const content = reply(body);
            response.writeHead(200, {"content-type": "application/json"});
            response.end(JSON.stringify({
                candidates: [{content: {role: "model", ...content}, finishReason: "STOP"}],
                usageMetadata: {promptTokenCount: 10, candidatesTokenCount: 5},
            }));
        } catch (error) {
            response.writeHead(400, {"content-type": "application/json"});
            response.end(JSON.stringify({error: {message: String(error)}}));
        }
    });
}).listen(PORT, () => console.log(`mock Gemma on http://localhost:${PORT}/v1beta`));
