import {nextWorkflow, workflowStatus} from "./web-workflow";

describe("shared operation lifecycle", () => {
    it("maps legacy approval/export to verified, never paid", () => {
        expect(workflowStatus({status: "approved"})).toBe("verified");
        expect(workflowStatus({status: "exported"})).toBe("verified");
        expect(
            workflowStatus({status: "exported", payoutAt: "2026-10-14"})
        ).toBe("paid_out");
    });
    it("keeps deposit verification distinct from payout", () => {
        expect(nextWorkflow("proof_submitted", "verify")).toBe("verified");
        expect(nextWorkflow("verified", "payout")).toBe("paid_out");
        expect(() => nextWorkflow("proof_submitted", "payout")).toThrow();
    });
    it("requires a new proof after a correction and rejects later cancellation", () => {
        expect(nextWorkflow("proof_submitted", "request_proof")).toBe(
            "awaiting_payment"
        );
        expect(() => nextWorkflow("paid_out", "cancel")).toThrow();
        expect(() => nextWorkflow("cancelled", "verify")).toThrow();
    });
});
