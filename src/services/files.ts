import {File, Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";

export type SharedFile = {
    filename: string;
    mimeType: string;
    /** Plain text, or base64 when `encoding` is "base64". */
    content: string;
    encoding?: "utf8" | "base64";
};

/** Native: write the file to the cache and open the system share sheet. */
export const shareFile = async ({
    filename,
    mimeType,
    content,
    encoding = "utf8",
}: SharedFile): Promise<void> => {
    const file = new File(Paths.cache, filename);
    file.create({overwrite: true});
    file.write(content, {encoding});
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {mimeType});
    }
};
