import type {SharedFile} from "./files";

export type {SharedFile};

/** Web: build a Blob and trigger a normal browser download. */
export const shareFile = async ({
    filename,
    mimeType,
    content,
    encoding = "utf8",
}: SharedFile): Promise<void> => {
    const bytes =
        encoding === "base64"
            ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
            : new TextEncoder().encode(content);
    const url = URL.createObjectURL(new Blob([bytes], {type: mimeType}));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
