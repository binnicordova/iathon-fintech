import {Picker} from "@expo/ui";
import {Surface} from "@/components/atoms/Surface/Surface";
import {RADIUS} from "@/theme/border";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type SelectOption<T extends string> = {label: string; value: T};

export type SelectFieldProps<T extends string> = {
    value: T;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
    invalid?: boolean;
    enabled?: boolean;
    /** Fixed width, to sit beside a growing field. Full width when omitted. */
    width?: number;
    testID?: string;
};

/** A boxed dropdown: Expo UI's menu `Picker` inside the same frame as a text field. */
export const SelectField = <T extends string>({
    value,
    options,
    onChange,
    invalid,
    enabled,
    width,
    testID,
}: SelectFieldProps<T>) => {
    const {surface, fieldBorder, error} = useTheme();

    return (
        <Surface
            fill={width === undefined}
            width={width}
            testID={testID}
            direction="row"
            alignment="center"
            paddingHorizontal={SPACING[2]}
            radius={RADIUS[5] * 1.5}
            backgroundColor={surface}
            borderColor={invalid ? error : fieldBorder}
            borderWidth={1}
        >
            <Picker
                selectedValue={value}
                onValueChange={(next) => onChange(next as T)}
                enabled={enabled}
                appearance="menu"
            >
                {options.map((option) => (
                    <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                    />
                ))}
            </Picker>
        </Surface>
    );
};
