import {Column, Row} from "@expo/ui";
import {useAtom, useAtomValue} from "jotai";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {BankField} from "@/components/molecules/BankField/BankField";
import {Field} from "@/components/molecules/Field/Field";
import {SelectField} from "@/components/molecules/SelectField/SelectField";
import {maskAccount} from "@/domain/validators";
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

/**
 * "Completa los datos": the same fields the assistant asks one at a time.
 * Both write to `clientDraftAtom`, so switching between them loses nothing.
 */
export const ClientDataForm = ({
    sendCurrency,
    receiveCurrency,
    errors,
}: ClientDataFormProps) => {
    const t = useT();
    const {muted} = useTheme();
    const [draft, setDraft] = useAtom(clientDraftAtom);
    const profile = useAtomValue(profileAtom);

    const set = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) =>
        setDraft((prev) => ({...prev, [key]: value}));

    const message = (field: keyof ClientDraft) =>
        errors[field] ? t(errors[field]) : undefined;

    const saved = (currency: Currency) =>
        (profile?.accounts ?? []).filter(
            (account) => account.currency === currency
        );

    return (
        <Column spacing={SPACING[4]}>
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
                label={t("data.sourceAccount")}
                error={message("sourceAccount")}
                testID="field-source-account"
            >
                <TextField
                    testID="input-source-account"
                    value={draft.sourceAccount}
                    invalid={Boolean(errors.sourceAccount)}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(text) => set("sourceAccount", text)}
                />
            </Field>
            <SavedAccounts
                accounts={saved(sendCurrency)}
                onPick={(bank, account) =>
                    setDraft((prev) => ({
                        ...prev,
                        sourceBank: bank,
                        sourceAccount: account,
                    }))
                }
            />

            <Field
                label={t("data.destBank")}
                error={message("destinationBank")}
                testID="field-dest-bank"
            >
                <BankField
                    testID="select-dest-bank"
                    currency={receiveCurrency}
                    value={draft.destinationBank}
                    invalid={Boolean(errors.destinationBank)}
                    onChange={(bank) => set("destinationBank", bank)}
                />
            </Field>
            <Field
                label={t("data.destAccount")}
                error={message("destinationAccount")}
                testID="field-dest-account"
            >
                <TextField
                    testID="input-dest-account"
                    value={draft.destinationAccount}
                    invalid={Boolean(errors.destinationAccount)}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(text) => set("destinationAccount", text)}
                />
            </Field>
            <SavedAccounts
                accounts={saved(receiveCurrency)}
                onPick={(bank, account) =>
                    setDraft((prev) => ({
                        ...prev,
                        destinationBank: bank,
                        destinationAccount: account,
                    }))
                }
            />

            <Text type="caption" color={muted}>
                {t("data.ownName")}
            </Text>
        </Column>
    );
};

type SavedAccountsProps = {
    accounts: Array<{id: string; bank: string; accountNumber: string}>;
    onPick: (bank: string, accountNumber: string) => void;
};

const SavedAccounts = ({accounts, onPick}: SavedAccountsProps) => {
    const t = useT();
    const {muted} = useTheme();

    if (accounts.length === 0) {
        return null;
    }
    return (
        <Surface fill spacing={SPACING[1]}>
            <Text type="caption" color={muted}>
                {t("data.saved")}
            </Text>
            <Column spacing={SPACING[1]} alignment="start">
                {accounts.slice(0, 3).map((account) => (
                    <Chip
                        key={account.id}
                        testID={`saved-${account.id}`}
                        icon="bank"
                        tone="neutral"
                        label={`${account.bank} ${maskAccount(account.accountNumber)}`}
                        onPress={() =>
                            onPick(account.bank, account.accountNumber)
                        }
                    />
                ))}
            </Column>
        </Surface>
    );
};
