import {Column, Row} from "@expo/ui";
import {useAtom, useAtomValue} from "jotai";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {AccountField} from "@/components/molecules/AccountField/AccountField";
import {BankField} from "@/components/molecules/BankField/BankField";
import {Field} from "@/components/molecules/Field/Field";
import {Notice} from "@/components/molecules/Notice/Notice";
import {SelectField} from "@/components/molecules/SelectField/SelectField";
import {useT} from "@/hooks/useT";
import type {Currency} from "@/models/currency";
import type {ClientDraft} from "@/models/draft";
import {DOC_TYPES, FUNDS_SOURCES, type FundsSource} from "@/models/order";
import {clientDraftAtom, profileAtom} from "@/stores/order";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";
import type {DraftErrors} from "@/utils/clientDraft";

export type ClientDataFormProps = {
    sendCurrency: Currency;
    receiveCurrency: Currency;
    errors: DraftErrors;
};

const IDENTITY_FIELDS = ["clientName", "email", "docNumber"] as const;

/**
 * "Completa los datos": three questions (the bank you pay from, the account
 * you receive in, where the funds come from). Name, email and document are
 * asked once, only until the client has a saved profile. The assistant fills
 * the same `clientDraftAtom`, so switching between them loses nothing.
 */
export const ClientDataForm = ({
    sendCurrency,
    receiveCurrency,
    errors,
}: ClientDataFormProps) => {
    const t = useT();
    const [draft, setDraft] = useAtom(clientDraftAtom);
    const profile = useAtomValue(profileAtom);

    const set = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) =>
        setDraft((prev) => ({...prev, [key]: value}));

    const showIdentity =
        !profile || IDENTITY_FIELDS.some((field) => errors[field]);

    const message = (field: keyof ClientDraft) =>
        errors[field] ? t(errors[field]) : undefined;

    const saved = (currency: Currency) =>
        (profile?.accounts ?? []).filter(
            (account) => account.currency === currency
        );

    return (
        <Column spacing={SPACING[4]}>
            {showIdentity && <IdentityFields errors={errors} />}

            <Field
                label={t("data.sourceBank")}
                error={message("sourceBank")}
                testID="field-source-bank"
            >
                <BankField
                    testID="select-source-bank"
                    currency={sendCurrency}
                    value={draft.sourceBank}
                    invalid={Boolean(errors.sourceBank)}
                    onChange={(bank) => set("sourceBank", bank)}
                />
            </Field>

            <Field
                label={t("data.destPick")}
                error={
                    message("destinationBank") ?? message("destinationAccount")
                }
                testID="field-dest-account"
            >
                <AccountField
                    testID="select-dest-account"
                    currency={receiveCurrency}
                    saved={saved(receiveCurrency)}
                    bank={draft.destinationBank}
                    accountNumber={draft.destinationAccount}
                    invalidBank={Boolean(errors.destinationBank)}
                    invalidAccount={Boolean(errors.destinationAccount)}
                    onChange={(bank, account) =>
                        setDraft((prev) => ({
                            ...prev,
                            destinationBank: bank,
                            destinationAccount: account,
                        }))
                    }
                />
            </Field>

            <Notice tone="warning">{t("data.ownName")}</Notice>

            <Field
                label={t("data.fundsSource")}
                error={message("fundsSource")}
                testID="field-funds"
            >
                <SelectField<FundsSource | "">
                    testID="select-funds"
                    invalid={Boolean(errors.fundsSource)}
                    value={draft.fundsSource}
                    options={[
                        {label: t("common.select"), value: ""},
                        ...FUNDS_SOURCES.map((source) => ({
                            label: t(`funds.${source}`),
                            value: source,
                        })),
                    ]}
                    onChange={(value) => set("fundsSource", value)}
                />
            </Field>
        </Column>
    );
};

/** First-time clients only: who is sending. Saved to the profile afterwards. */
const IdentityFields = ({errors}: {errors: DraftErrors}) => {
    const t = useT();
    const {muted} = useTheme();
    const [draft, setDraft] = useAtom(clientDraftAtom);

    const set = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) =>
        setDraft((prev) => ({...prev, [key]: value}));
    const message = (field: keyof ClientDraft) =>
        errors[field] ? t(errors[field]) : undefined;

    return (
        <Column spacing={SPACING[4]}>
            <Text type="subtitle">{t("data.you")}</Text>
            <Field
                label={t("data.name")}
                error={message("clientName")}
                testID="field-name"
            >
                <TextField
                    testID="input-name"
                    value={draft.clientName}
                    invalid={Boolean(errors.clientName)}
                    autoCapitalize="words"
                    autoComplete="name"
                    onChangeText={(text) => set("clientName", text)}
                />
            </Field>

            <Field
                label={t("data.email")}
                error={message("email")}
                testID="field-email"
            >
                <TextField
                    testID="input-email"
                    value={draft.email}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    onChangeText={(text) => set("email", text)}
                />
            </Field>

            <Row spacing={SPACING[2]} alignment="start">
                <Surface width={120} spacing={SPACING[1]}>
                    <Text type="label" color={muted}>
                        {t("data.docType")}
                    </Text>
                    <SelectField
                        testID="select-doc-type"
                        value={draft.docType}
                        options={DOC_TYPES.map((type) => ({
                            label: type,
                            value: type,
                        }))}
                        onChange={(type) => set("docType", type)}
                    />
                </Surface>
                <Surface grow>
                    <Field
                        label={t("data.docNumber")}
                        error={message("docNumber")}
                        testID="field-doc"
                    >
                        <TextField
                            testID="input-doc"
                            value={draft.docNumber}
                            invalid={Boolean(errors.docNumber)}
                            keyboardType={
                                draft.docType === "CE"
                                    ? "default"
                                    : "number-pad"
                            }
                            autoCapitalize="characters"
                            autoCorrect={false}
                            onChangeText={(text) => set("docNumber", text)}
                        />
                    </Field>
                </Surface>
            </Row>
        </Column>
    );
};
