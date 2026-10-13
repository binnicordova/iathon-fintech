import type {Currency} from "@/models/currency";

/** Where a client can send from / receive into. Free text is allowed too. */
export const BANKS: Record<"BR" | "PE", string[]> = {
    BR: [
        "Nubank",
        "Itaú",
        "Bradesco",
        "Banco do Brasil",
        "Santander",
        "Caixa",
        "Inter",
        "C6 Bank",
    ],
    PE: ["BCP", "Interbank", "BBVA", "Scotiabank", "BanBif", "Pichincha"],
};

export const OTHER_BANK = "__other__";

export const banksFor = (currency: Currency): string[] =>
    currency === "BRL"
        ? BANKS.BR
        : currency === "PEN"
          ? BANKS.PE
          : [...BANKS.PE, ...BANKS.BR];
