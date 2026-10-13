import * as ImagePicker from "expo-image-picker";
import {useAtomValue} from "jotai";
import {useCallback, useState} from "react";
import {isValidOperationNo} from "@/domain/validators";
import {type ApiError, api, toApiError} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {uploadProof} from "@/services/orders";
import {sessionAtom} from "@/stores/session";

export type ProofImage = {uri: string; mimeType: string};

export type ProofIssue =
    | "operationNo"
    | "photo"
    | "duplicate"
    | "permission"
    | "network"
    | "generic";

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.6,
    allowsEditing: false,
};

const toIssue = (error: ApiError): ProofIssue => {
    switch (error.code) {
        case "operation-no-duplicate":
            return "duplicate";
        case "invalid-operation-no":
            return "operationNo";
        case "network":
            return "network";
        default:
            return "generic";
    }
};

/**
 * Shared by the proof screen and the assistant's proof card: pick a photo,
 * upload it to private Storage, then record the operation number on the order.
 */
export const useProofUpload = (orderId: string) => {
    const uid = useAtomValue(sessionAtom)?.uid;
    const [image, setImage] = useState<ProofImage | null>(null);
    const [busy, setBusy] = useState(false);
    const [issue, setIssue] = useState<ProofIssue | null>(null);

    const pick = useCallback(async (source: "gallery" | "camera") => {
        setIssue(null);
        if (source === "camera") {
            const permission =
                await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                setIssue("permission");
                return;
            }
        }
        const result =
            source === "camera"
                ? await ImagePicker.launchCameraAsync(PICK_OPTIONS)
                : await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
        const asset = result.canceled ? null : result.assets[0];
        if (asset) {
            setImage({
                uri: asset.uri,
                mimeType: asset.mimeType ?? "image/jpeg",
            });
        }
    }, []);

    const submit = useCallback(
        async (operationNo: string): Promise<boolean> => {
            setIssue(null);
            if (!isValidOperationNo(operationNo)) {
                setIssue("operationNo");
                return false;
            }
            if (!image || !uid) {
                setIssue("photo");
                return false;
            }
            setBusy(true);
            try {
                const proofPath = await uploadProof(
                    uid,
                    orderId,
                    image.uri,
                    image.mimeType
                );
                await api.submitProof({
                    orderId,
                    operationNo: operationNo.trim(),
                    proofPath,
                });
                return true;
            } catch (caught) {
                reportError(caught, "submitProof");
                setIssue(toIssue(toApiError(caught)));
                return false;
            } finally {
                setBusy(false);
            }
        },
        [image, orderId, uid]
    );

    return {image, setImage, pick, submit, busy, issue};
};
