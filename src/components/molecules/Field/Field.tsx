import type {ReactNode} from "react";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type FieldProps = {
    label: string;
    error?: string;
    hint?: string;
    children: ReactNode;
    testID?: string;
};

/** A label, a control and, when needed, one line saying what is wrong. */
export const Field = ({label, error, hint, children, testID}: FieldProps) => {
    const {muted, error: errorColor} = useTheme();

    return (
        <Surface fill spacing={SPACING[1]} testID={testID}>
            <Text type="label" color={muted}>
                {label}
            </Text>
            {children}
            {error ? (
                <Text
                    type="caption"
                    color={errorColor}
                    testID={`${testID}-error`}
                >
                    {error}
                </Text>
            ) : hint ? (
                <Text type="caption" color={muted}>
                    {hint}
                </Text>
            ) : null}
        </Surface>
    );
};
