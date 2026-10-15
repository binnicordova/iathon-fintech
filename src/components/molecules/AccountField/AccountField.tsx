import {useState} from "react";
import {Surface} from "@/components/atoms/Surface/Surface";
import {TextField} from "@/components/atoms/TextField/TextField";
import {BankField} from "@/components/molecules/BankField/BankField";
import {SelectField} from "@/components/molecules/SelectField/SelectField";
import {maskAccount} from "@/domain/validators";
import {useT} from "@/hooks/useT";
import type {SavedAccount} from "@/models/client";
import type {Currency} from "@/models/currency";
import {SPACING} from "@/theme/spacing";

const NEW_ACCOUNT = "__new__";

export type AccountFieldProps = {
    currency: Currency;
    /** Accounts the client registered on earlier orders, already in `currency`. */
    saved: SavedAccount[];
    bank: string;
    accountNumber: string;
    onChange: (bank: string, accountNumber: string) => void;
    invalidBank?: boolean;
    invalidAccount?: boolean;
    testID?: string;
};

/**
 * Where the money lands: a menu of the accounts used before, plus "Another
 * account" to type a new bank and number. With nothing saved it is just the
 * two inputs.
 */
export const AccountField = ({
    currency,
    saved,
    bank,
    accountNumber,
    onChange,
    invalidBank,
    invalidAccount,
    testID,
}: AccountFieldProps) => {
    const t = useT();
    const match = saved.find(
        (account) =>
            account.bank === bank && account.accountNumber === accountNumber
    );
    const [manual, setManual] = useState(
        saved.length === 0 || (!match && (bank !== "" || accountNumber !== ""))
    );
    const showInputs = manual || saved.length === 0;

    return (
        <Surface fill spacing={SPACING[2]}>
            {saved.length > 0 && (
                <SelectField
                    testID={testID}
                    invalid={(invalidBank || invalidAccount) && !showInputs}
                    value={showInputs ? NEW_ACCOUNT : (match?.id ?? "")}
                    options={[
                        {label: t("common.select"), value: ""},
                        ...saved.map((account) => ({
                            label: `${account.bank} ${maskAccount(account.accountNumber)}`,
                            value: account.id,
                        })),
                        {label: t("data.newAccount"), value: NEW_ACCOUNT},
                    ]}
                    onChange={(next) => {
                        if (next === NEW_ACCOUNT) {
                            setManual(true);
                            onChange("", "");
                            return;
                        }
                        setManual(false);
                        const picked = saved.find(
                            (account) => account.id === next
                        );
                        onChange(
                            picked?.bank ?? "",
                            picked?.accountNumber ?? ""
                        );
                    }}
                />
            )}
            {showInputs && (
                <>
                    <BankField
                        testID={`${testID}-bank`}
                        currency={currency}
                        value={bank}
                        invalid={invalidBank}
                        onChange={(next) => onChange(next, accountNumber)}
                    />
                    <TextField
                        testID={`${testID}-number`}
                        value={accountNumber}
                        invalid={invalidAccount}
                        placeholder={t("data.destAccount")}
                        keyboardType="default"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(text) => onChange(bank, text)}
                    />
                </>
            )}
        </Surface>
    );
};
