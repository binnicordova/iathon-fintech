export const STAFF_ROLES = [
    "admin",
    "validator",
    "operator",
    "billing",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
