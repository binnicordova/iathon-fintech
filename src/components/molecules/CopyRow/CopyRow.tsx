import {Row, Spacer} from "@expo/ui";
import * as Clipboard from "expo-clipboard";
import {useEffect, useState} from "react";
import {IconButton} from "@/components/atoms/IconButton/IconButton";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {useT} from "@/hooks/useT";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type CopyRowProps = {
    label: string;
    value: string;
    /** What lands on the clipboard, when it differs from what is shown. */
    copyValue?: string;
    copyable?: boolean;
    emphasis?: boolean;
    testID?: string;
};

/** "Cuenta •••• •••• ⧉": a payment detail with a copy button. */
export const CopyRow = ({
    label,
    value,
    copyValue,
    copyable = true,
    emphasis,
    testID,
}: CopyRowProps) => {
    const t = useT();
    const {muted, success} = useTheme();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(timer);
    }, [copied]);

    return (
        <Surface fill spacing={SPACING[1]} testID={testID}>
            <Text type="caption" color={muted}>
                {label}
            </Text>
            <Row alignment="center" spacing={SPACING[2]} {...fullWidth()}>
                <Text
                    type={emphasis ? "subtitle" : "default"}
                    testID={testID ? `${testID}-value` : undefined}
                >
                    {value}
                </Text>
                <Spacer flexible />
                {copied && (
                    <Text type="caption" color={success}>
                        {t("common.copied")}
                    </Text>
                )}
                {copyable && (
                    <IconButton
                        name={copied ? "check" : "copy"}
                        testID={testID ? `${testID}-copy` : undefined}
                        color={copied ? success : undefined}
                        onPress={() => {
                            Clipboard.setStringAsync(copyValue ?? value)
                                .then(() => setCopied(true))
                                .catch(() => undefined);
                        }}
                    />
                )}
            </Row>
        </Surface>
    );
};
