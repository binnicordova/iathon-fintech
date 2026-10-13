import {useState} from "react";
import {Surface} from "@/components/atoms/Surface/Surface";
import {TextField} from "@/components/atoms/TextField/TextField";
import {SelectField} from "@/components/molecules/SelectField/SelectField";
import {banksFor, OTHER_BANK} from "@/constants/banks";
import {useT} from "@/hooks/useT";
import type {Currency} from "@/models/currency";
import {SPACING} from "@/theme/spacing";

export type BankFieldProps = {
    currency: Currency;
    value: string;
    onChange: (bank: string) => void;
    invalid?: boolean;
    testID?: string;
};

/** A bank menu for the account's country, with "Other" for free text. */
export const BankField = ({
    currency,
    value,
    onChange,
    invalid,
    testID,
}: BankFieldProps) => {
    const t = useT();
    const banks = banksFor(currency);
    const isListed = banks.includes(value);
    const [otherMode, setOtherMode] = useState(value !== "" && !isListed);

    const selected = otherMode ? OTHER_BANK : isListed ? value : "";

    return (
        <Surface fill spacing={SPACING[2]}>
            <SelectField
                testID={testID}
                invalid={invalid && !otherMode}
                value={selected}
                options={[
                    {label: t("common.select"), value: ""},
                    ...banks.map((bank) => ({label: bank, value: bank})),
                    {label: t("data.otherBank"), value: OTHER_BANK},
                ]}
                onChange={(next) => {
                    if (next === OTHER_BANK) {
                        setOtherMode(true);
                        onChange("");
                        return;
                    }
                    setOtherMode(false);
                    onChange(next);
                }}
            />
            {otherMode && (
                <TextField
                    testID={`${testID}-other`}
                    value={value}
                    invalid={invalid}
                    placeholder={t("data.bankName")}
                    autoCapitalize="words"
                    onChangeText={onChange}
                />
            )}
        </Surface>
    );
};
