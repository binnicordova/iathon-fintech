import {Row, Spacer} from "@expo/ui";
import {ProgressBar} from "@/components/atoms/ProgressBar/ProgressBar";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {AppBar} from "@/components/molecules/AppBar/AppBar";
import {useT} from "@/hooks/useT";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type StepHeaderProps = {
    title: string;
    /** 1–3, as in the plan's "Completa los datos 1 / 3". */
    step: 1 | 2 | 3;
};

export const StepHeader = ({title, step}: StepHeaderProps) => {
    const t = useT();
    const {muted} = useTheme();

    return (
        <Surface fill spacing={SPACING[1]}>
            <AppBar
                title={title}
                actions={() => (
                    <Row alignment="center">
                        <Spacer flexible />
                        <Text type="label" color={muted} testID="step-counter">
                            {t("common.step", {n: step})}
                        </Text>
                    </Row>
                )}
            />
            <ProgressBar progress={step / 3} testID="step-progress" />
        </Surface>
    );
};
