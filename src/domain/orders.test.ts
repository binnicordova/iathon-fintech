import {
    canTransition,
    formatOrderId,
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
    const states = (status: Parameters<typeof timelineFor>[0]["status"]) =>
        timelineFor({status}).map((step) => step.state);

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

    it("marks the money as sent once approved", () => {
        expect(states("approved")).toEqual(["done", "done", "done", "todo"]);
    });

    it("waits for the money to arrive once exported", () => {
        expect(states("exported")).toEqual(["done", "done", "done", "active"]);
    });

    it("flags a rejection on the verification step", () => {
        expect(states("rejected")).toEqual(["done", "failed", "todo", "todo"]);
    });
});
