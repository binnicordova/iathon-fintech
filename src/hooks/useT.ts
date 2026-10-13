import {useAtomValue} from "jotai";
import {useCallback} from "react";
import {type Params, type TranslationKey, translate} from "@/i18n";
import {languageAtom} from "@/stores/language";

export const useLanguage = () => useAtomValue(languageAtom);

export const useT = () => {
    const language = useAtomValue(languageAtom);
    return useCallback(
        (key: TranslationKey, params?: Params) =>
            translate(language, key, params),
        [language]
    );
};
