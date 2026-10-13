import {Row} from "@expo/ui";
import {useAtom} from "jotai";
import {Chip} from "@/components/atoms/Chip/Chip";
import {LANGUAGES} from "@/models/currency";
import {languageAtom} from "@/stores/language";
import {SPACING} from "@/theme/spacing";

/** ES · PT · EN, as on the plan's calculator. */
export const LanguageSwitch = () => {
    const [language, setLanguage] = useAtom(languageAtom);

    return (
        <Row spacing={SPACING[1]} alignment="center">
            {LANGUAGES.map((code) => (
                <Chip
                    key={code}
                    testID={`lang-${code}`}
                    label={code.toUpperCase()}
                    tone="neutral"
                    selected={language === code}
                    onPress={() => setLanguage(code)}
                />
            ))}
        </Row>
    );
};
