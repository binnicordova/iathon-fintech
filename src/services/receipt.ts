import {api} from "@/services/api";
import {shareFile} from "@/services/files";

/** Fetches the PDF receipt from the server and saves or shares it. */
export const downloadReceipt = async (orderId: string): Promise<void> => {
    const receipt = await api.getReceipt({orderId});
    await shareFile({
        filename: receipt.filename,
        mimeType: receipt.contentType,
        content: receipt.base64,
        encoding: "base64",
    });
};
