import {getLocales} from "expo-localization";
import type {Language} from "@/models/currency";
import {LANGUAGES} from "@/models/currency";
import {en} from "./en";
import {type Dictionary, es, type TranslationKey} from "./es";
import {pt} from "./pt";

export type {TranslationKey};

export const DICTIONARIES: Record<Language, Dictionary> = {es, pt, en};

export const detectLanguage = (): Language => {
    const code = getLocales()[0]?.languageCode ?? "es";
    return (LANGUAGES as readonly string[]).includes(code)
        ? (code as Language)
        : "es";
};

export type Params = Record<string, string | number>;

export const translate = (
    language: Language,
    key: TranslationKey,
    params?: Params
): string => {
    const template = DICTIONARIES[language][key] ?? es[key];
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match
    );
};
