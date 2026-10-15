import {Column, Row} from "@expo/ui";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {Card} from "@/components/molecules/Card/Card";
import {Field} from "@/components/molecules/Field/Field";
import {ImagePreview} from "@/components/molecules/ImagePreview/ImagePreview";
import {Notice} from "@/components/molecules/Notice/Notice";
import type {ProofImage, ProofIssue} from "@/hooks/useProofUpload";
import {useT} from "@/hooks/useT";
import type {TranslationKey} from "@/i18n";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

const ISSUE_MESSAGE: Record<ProofIssue, TranslationKey> = {
    operationNo: "proof.err.operationNo",
    photo: "proof.err.photo",
    duplicate: "proof.err.duplicate",
    permission: "proof.err.permission",
    network: "common.offline",
    generic: "common.error",
};

export type ProofFormProps = {
    operationNo: string;
    onOperationNo: (value: string) => void;
    image: ProofImage | null;
    onPick: (source: "gallery" | "camera") => void;
    issue: ProofIssue | null;
    disabled?: boolean;
};

/**
 * "Envía tu constancia": the bank operation number and the proof photo. The
 * photo goes straight to private storage; nobody here judges it.
 */
export const ProofForm = ({
    operationNo,
    onOperationNo,
    image,
    onPick,
    issue,
    disabled,
}: ProofFormProps) => {
    const t = useT();
    const {muted} = useTheme();

    return (
        <Column spacing={SPACING[4]}>
            <Field
                label={t("proof.operationNo")}
                error={
                    issue === "operationNo"
                        ? t(ISSUE_MESSAGE.operationNo)
                        : undefined
                }
                testID="field-operation-no"
            >
                <TextField
                    testID="input-operation-no"
                    value={operationNo}
                    placeholder="000000"
                    invalid={issue === "operationNo" || issue === "duplicate"}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="default"
                    onChangeText={onOperationNo}
                />
            </Field>

            <Card spacing={SPACING[3]}>
                <Text type="label" color={muted}>
                    {t("proof.photo")}
                </Text>
                {image ? (
                    <ImagePreview testID="proof-preview" uri={image.uri} />
                ) : null}
                <Row spacing={SPACING[2]} alignment="center">
                    <Chip
                        testID="proof-gallery"
                        icon="image"
                        tone="accent"
                        label={image ? t("proof.change") : t("proof.gallery")}
                        disabled={disabled}
                        onPress={() => onPick("gallery")}
                    />
                    <Chip
                        testID="proof-camera"
                        icon="camera"
                        tone="neutral"
                        label={t("proof.camera")}
                        disabled={disabled}
                        onPress={() => onPick("camera")}
                    />
                </Row>
                <Text type="caption" color={muted}>
                    {t("proof.verify")}
                </Text>
            </Card>

            {issue && issue !== "operationNo" && (
                <Notice tone="error" testID="proof-error">
                    {t(ISSUE_MESSAGE[issue])}
                </Notice>
            )}
        </Column>
    );
};
