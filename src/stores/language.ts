import {STORAGE_KEYS} from "@/constants/storage";
import {detectLanguage} from "@/i18n";
import type {Language} from "@/models/currency";
import {persistedAtom} from "./persisted";

export const languageAtom = persistedAtom<Language>(
    STORAGE_KEYS.language,
    detectLanguage()
);
