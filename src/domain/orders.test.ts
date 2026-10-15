import {
    canTransition,
    formatOrderId,
    invoiceNumber,
    isOpenOrder,
    parseOrderSeq,
    timelineFor,
} from "./orders";

describe("order ids", () => {
    it("formats and parses BR-0001", () => {
        expect(formatOrderId(1)).toBe("BR-0001");
        expect(formatOrderId(12345)).toBe("BR-12345");
        expect(parseOrderSeq("br-0042")).toBe(42);
        expect(parseOrderSeq("XX-1")).toBeNull();
    });

    it("zero-pads invoice numbers", () => {
        expect(invoiceNumber("B001", 3)).toBe("B001-00000003");
    });
});

describe("status machine", () => {
    it("allows the normal path only", () => {
        expect(canTransition("pending", "validating")).toBe(true);
        expect(canTransition("validating", "approved")).toBe(true);
        expect(canTransition("approved", "exported")).toBe(true);
        expect(canTransition("pending", "approved")).toBe(false);
        expect(canTransition("exported", "pending")).toBe(false);
        expect(canTransition("rejected", "approved")).toBe(false);
    });

    it("knows which orders are still open", () => {
        expect(isOpenOrder("pending")).toBe(true);
        expect(isOpenOrder("validating")).toBe(true);
        expect(isOpenOrder("approved")).toBe(false);
    });
});

describe("timelineFor", () => {
    const states = (
        status: Parameters<typeof timelineFor>[0]["status"],
        invoiceStatus = null
    ) => timelineFor({status, invoiceStatus}).map((step) => step.state);

    it("starts registered, waiting for proof", () => {
        expect(states("pending")).toEqual(["done", "todo", "todo", "todo"]);
    });

    it("shows verification in progress", () => {
        expect(states("validating")).toEqual([
            "done",
            "active",
            "todo",
            "todo",
        ]);
    });

    it("does not mark approval as a payout", () => {
        expect(states("approved")).toEqual(["done", "done", "todo", "todo"]);
    });

    it("does not infer a payout or receipt of funds from a document", () => {
        expect(states("exported", "accepted" as never)).toEqual([
            "done",
            "done",
            "todo",
            "todo",
        ]);
        expect(states("exported")).toEqual(["done", "done", "todo", "todo"]);
        expect(
            timelineFor({
                status: "exported",
                invoiceStatus: null,
                payoutAt: "2026-10-14T00:00:00Z",
            }).map((s) => s.state)
        ).toEqual(["done", "done", "done", "active"]);
    });

    it("flags a rejection on the verification step", () => {
        expect(states("rejected")).toEqual(["done", "failed", "todo", "todo"]);
    });
});
