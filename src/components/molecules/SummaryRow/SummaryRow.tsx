import {Row, Spacer} from "@expo/ui";
import {Text, type TextType} from "@/components/atoms/Text/Text";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type SummaryRowProps = {
    label: string;
    value: string;
    emphasis?: boolean;
    valueType?: TextType;
    testID?: string;
};

/** "Comisión ........ R$ 12.00": one line of a quote or an order. */
export const SummaryRow = ({
    label,
    value,
    emphasis,
    valueType,
    testID,
}: SummaryRowProps) => {
    const {muted, text} = useTheme();

    return (
        <Row alignment="center" spacing={SPACING[2]} {...fullWidth()}>
            <Text
                type={emphasis ? "default" : "label"}
                color={emphasis ? text : muted}
            >
                {label}
            </Text>
            <Spacer flexible />
            <Text
                type={valueType ?? (emphasis ? "subtitle" : "label")}
                testID={testID}
            >
                {value}
            </Text>
        </Row>
    );
};
