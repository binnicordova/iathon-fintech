import {useTheme} from "@/theme/useTheme";
import type {SelectFieldProps} from "./SelectField";

/**
 * Web: a real `<select>` themed to match the text fields, so it keeps the
 * browser's native menu, keyboard support and mobile picker.
 */
export const SelectField = <T extends string>({
    value,
    options,
    onChange,
    invalid,
    enabled = true,
    width,
    testID,
}: SelectFieldProps<T>) => {
    const {surface, text, fieldBorder, error} = useTheme();

    return (
        <select
            data-testid={testID}
            value={value}
            disabled={!enabled}
            onChange={(event) => onChange(event.target.value as T)}
            style={{
                width: width ?? "100%",
                height: 48,
                boxSizing: "border-box",
                backgroundColor: surface,
                color: text,
                border: `1px solid ${invalid ? error : fieldBorder}`,
                borderRadius: 12,
                paddingLeft: 12,
                paddingRight: 12,
                fontSize: 17,
                fontFamily: "LatoRegular, system-ui, sans-serif",
                outline: "none",
                cursor: "pointer",
            }}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};
