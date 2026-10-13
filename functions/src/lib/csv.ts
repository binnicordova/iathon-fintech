import {formatLimaDateTime} from "../shared/domain/hours";
import type {Order} from "../shared/models/order";

/**
 * Columns follow the plan's `orders` table. The real Dashboard import format is
 * still an open question; until a sample file exists this is the contract.
 */
export const EXPORT_COLUMNS = [
    "order_id",
    "created_at",
    "created_at_lima",
    "status",
    "client_name",
    "doc_type",
    "doc_number",
    "email",
    "destination_account",
    "send_amount",
    "send_currency",
    "receive_amount",
    "receive_currency",
    "rate",
    "commission",
    "tax",
    "total",
    "funds_source",
    "operation_no",
    "payment_proof_path",
    "validated_by",
    "validated_at",
] as const;

const escapeCell = (value: string | number | null): string => {
    if (value === null) {
        return "";
    }
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const orderToRow = (order: Order): Array<string | number | null> => [
    order.orderId,
    order.createdAt,
    formatLimaDateTime(new Date(order.createdAt)),
    order.status,
    order.clientName,
    order.docType,
    order.docNumber,
    order.email,
    `${order.destinationBank} ${order.destinationAccount} (${order.receiveCurrency})`,
    order.sendAmount.toFixed(2),
    order.sendCurrency,
    order.receiveAmount.toFixed(2),
    order.receiveCurrency,
    order.rate,
    order.commission.toFixed(2),
    order.tax.toFixed(2),
    order.total.toFixed(2),
    order.fundsSource,
    order.operationNo,
    order.paymentProofPath,
    order.validatedBy,
    order.validatedAt,
];

export const ordersToCsv = (orders: Order[]): string =>
    [
        EXPORT_COLUMNS.join(","),
        ...orders.map((order) => orderToRow(order).map(escapeCell).join(",")),
    ].join("\n");
