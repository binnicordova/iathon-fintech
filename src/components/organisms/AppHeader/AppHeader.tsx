import {Row, Spacer} from "@expo/ui";
import {Text} from "@/components/atoms/Text/Text";
import {LanguageSwitch} from "@/components/molecules/LanguageSwitch/LanguageSwitch";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

/** The brand mark on the left, language on the right. */
export const AppHeader = () => {
    const {text, accent} = useTheme();

    return (
        <Row alignment="center" spacing={SPACING[2]} {...fullWidth()}>
            <Row alignment="center" spacing={0}>
                <Text type="title" color={text}>
                    Bras
                </Text>
                <Text type="title" color={accent}>
                    Per
                </Text>
            </Row>
            <Spacer flexible />
            <LanguageSwitch />
        </Row>
    );
};
