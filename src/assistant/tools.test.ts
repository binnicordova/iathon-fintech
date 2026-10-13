import {TOOL_DECLARATIONS, TOOLS} from "@/assistant/tools";

describe("tool declarations", () => {
    it("declares every tool with a Gemini-safe schema", () => {
        expect(TOOL_DECLARATIONS.map((tool) => tool.name)).toEqual(
            TOOLS.map((tool) => tool.name)
        );
        for (const declaration of TOOL_DECLARATIONS) {
            expect(declaration.name).toMatch(/^[a-z][a-z0-9_]{0,48}$/);
            expect(declaration.description.length).toBeGreaterThan(10);
            const text = JSON.stringify(declaration.parameters);
            expect(text).not.toContain("$schema");
            expect(text).not.toContain("additionalProperties");
            expect((declaration.parameters as {type: string}).type).toBe(
                "object"
            );
        }
    });

    it("exposes no tool that can approve, export or create orders", () => {
        const names = TOOLS.map((tool) => tool.name).join(" ");
        expect(names).not.toMatch(
            /approve|export|create_order|review_order|validate/
        );
    });

    it("keeps enums for currencies and funds sources so the model cannot invent values", () => {
        const quote = JSON.stringify(
            TOOL_DECLARATIONS.find((tool) => tool.name === "get_quote")
        );
        expect(quote).toContain('"BRL"');
        const save = JSON.stringify(
            TOOL_DECLARATIONS.find((tool) => tool.name === "save_client_data")
        );
        expect(save).toContain("asset_sale");
    });
});

describe("schema sanitising", () => {
    it("drops JSON-schema keywords the Gemini API rejects", () => {
        const text = JSON.stringify(TOOL_DECLARATIONS);
        for (const keyword of [
            "exclusiveMinimum",
            "exclusiveMaximum",
            "$schema",
            "additionalProperties",
            "$ref",
        ]) {
            expect(text).not.toContain(keyword);
        }
    });
});
