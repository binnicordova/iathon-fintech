import {useLocalSearchParams, useRouter} from "expo-router";
import {useEffect, useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Text} from "@/components/atoms/Text/Text";
import {StepHeader} from "@/components/molecules/StepHeader/StepHeader";
import {ProofForm} from "@/components/organisms/ProofForm/ProofForm";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {useOrder} from "@/hooks/useOrder";
import {useProofUpload} from "@/hooks/useProofUpload";
import {useT} from "@/hooks/useT";
import {useTheme} from "@/theme/useTheme";

export default function ProofScreen() {
    const t = useT();
    const router = useRouter();
    const {muted} = useTheme();
    const {id} = useLocalSearchParams<{id: string}>();
    const orderId = id ?? "";
    const {data: order} = useOrder(orderId || null);
    const [operationNo, setOperationNo] = useState("");
    const {image, pick, submit, busy, issue} = useProofUpload(orderId);

    // Already submitted (or ended): nothing to send here any more.
    useEffect(() => {
        if (order && order.status !== "pending") {
            router.replace(PATHS.status(order.orderId));
        }
    }, [order, router]);

    const onSubmit = async () => {
        if (await submit(operationNo)) {
            router.replace(PATHS.status(orderId));
        }
    };

    return (
        <Screen
            header={<StepHeader title={t("proof.title")} step={3} />}
            footer={
                <Button
                    testID="proof-submit"
                    title={busy ? t("proof.uploading") : t("proof.submit")}
                    disabled={busy}
                    onPress={onSubmit}
                />
            }
        >
            <Text type="label" color={muted}>
                {orderId}
            </Text>
            <ProofForm
                operationNo={operationNo}
                onOperationNo={setOperationNo}
                image={image}
                onPick={pick}
                issue={issue}
                disabled={busy}
            />
        </Screen>
    );
}
