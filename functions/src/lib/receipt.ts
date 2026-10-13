import {PDFDocument, StandardFonts, rgb} from "pdf-lib";
import {formatLimaDateTime} from "../shared/domain/hours";
import {formatMoney} from "../shared/domain/money";
import type {Invoice} from "../shared/models/invoice";
import type {Order} from "../shared/models/order";

type ReceiptData = Pick<
    Invoice,
    "fullNumber" | "issuer" | "currency" | "taxableValue" | "tax" | "total" | "createdAt"
>;

const escapeXml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/**
 * Stand-in for the signed XML KeyFácil (SUNAT) or Omni (Brazil) would return.
 * It is stored untouched and the PDF is built from it, as in the real script,
 * but it is NOT a fiscal document.
 */
export const buildTestXml = (order: Order, invoice: ReceiptData): string =>
    [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!-- TEST MODE: not a fiscal document. Replace with the provider's signed XML. -->",
        "<Invoice>",
        `  <ID>${escapeXml(invoice.fullNumber)}</ID>`,
        `  <IssueDate>${escapeXml(invoice.createdAt)}</IssueDate>`,
        `  <Issuer>${escapeXml(invoice.issuer)}</Issuer>`,
        "  <Customer>",
        `    <Name>${escapeXml(order.clientName)}</Name>`,
        `    <DocumentType>${order.docType}</DocumentType>`,
        `    <DocumentNumber>${escapeXml(order.docNumber)}</DocumentNumber>`,
        `    <Email>${escapeXml(order.email)}</Email>`,
        "  </Customer>",
        `  <Reference>${escapeXml(order.orderId)}</Reference>`,
        `  <Currency>${invoice.currency}</Currency>`,
        `  <TaxableValue>${invoice.taxableValue.toFixed(2)}</TaxableValue>`,
        `  <Tax>${invoice.tax.toFixed(2)}</Tax>`,
        `  <Total>${invoice.total.toFixed(2)}</Total>`,
        "</Invoice>",
    ].join("\n");

/** Reads the totals back out of the XML, so the PDF can never drift from it. */
export const readTotalsFromXml = (
    xml: string
): {taxableValue: number; tax: number; total: number} | null => {
    const read = (tag: string): number | null => {
        const match = new RegExp(`<${tag}>([\\d.]+)</${tag}>`).exec(xml);
        return match ? Number(match[1]) : null;
    };
    const taxableValue = read("TaxableValue");
    const tax = read("Tax");
    const total = read("Total");
    return taxableValue === null || tax === null || total === null
        ? null
        : {taxableValue, tax, total};
};

/** Ascii only: the built-in PDF fonts cannot encode arrows or bullets. */
const ascii = (value: string): string =>
    value.normalize("NFD").replace(/[^\x20-\x7e]/g, "");

export const buildReceiptPdf = async (
    order: Order,
    invoice: ReceiptData
): Promise<Uint8Array> => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.05, 0.09, 0.2);
    const muted = rgb(0.33, 0.38, 0.49);

    let y = 790;
    const line = (
        text: string,
        options: {size?: number; font?: typeof regular; color?: ReturnType<typeof rgb>; x?: number} = {}
    ) => {
        page.drawText(ascii(text), {
            x: options.x ?? 50,
            y,
            size: options.size ?? 11,
            font: options.font ?? regular,
            color: options.color ?? ink,
        });
        y -= (options.size ?? 11) + 8;
    };

    line("BRASPER", {size: 22, font: bold, color: rgb(0.1, 0.36, 1)});
    line("COMPROBANTE DE PRUEBA - TEST MODE", {size: 12, font: bold, color: rgb(0.76, 0.2, 0.2)});
    line("Sin validez fiscal. Generado antes de conectar KeyFacil / Omni.", {size: 9, color: muted});
    y -= 14;

    line(`Emisor: ${invoice.issuer}`, {font: bold});
    line(`Comprobante: ${invoice.fullNumber}`);
    line(`Fecha: ${formatLimaDateTime(new Date(invoice.createdAt))} (hora de Lima)`);
    line(`Operacion: ${order.orderId}`);
    y -= 10;

    line("Cliente", {font: bold});
    line(order.clientName);
    line(`${order.docType} ${order.docNumber}`);
    line(order.email, {color: muted});
    y -= 10;

    line("Detalle", {font: bold});
    line(
        `Servicio de cambio: envia ${formatMoney(order.sendAmount, order.sendCurrency, "es")} ` +
            `y recibe ${formatMoney(order.receiveAmount, order.receiveCurrency, "es")} (tasa ${order.rate})`
    );
    y -= 10;

    const money = (value: number) => formatMoney(value, invoice.currency, "es");
    line(`Valor gravado (comision): ${money(invoice.taxableValue)}`);
    line(`Impuesto: ${money(invoice.tax)}`);
    line(`Total: ${money(invoice.total)}`, {size: 14, font: bold});

    return pdf.save();
};
