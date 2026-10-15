import {Box, DropdownMenu, DropdownMenuItem} from "@expo/ui/jetpack-compose";
import {
    clickable,
    clip,
    Shapes,
    testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import {useState} from "react";
import {Icon} from "@/components/atoms/Icon/Icon";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";
import type {SelectFieldProps} from "./SelectField";

const HEIGHT = 52;
const LARGE_HEIGHT = 64;
const RADIUS = 14;

/**
 * The Android select: a rounded outlined control that opens a Material dropdown
 * menu, instead of the borderless text button Expo UI's `Picker` draws.
 */
export const SelectField = <T extends string>({
    value,
    options,
    onChange,
    invalid,
    enabled = true,
    width,
    large,
    testID,
}: SelectFieldProps<T>) => {
    const {surface, fieldBorder, error, text, muted} = useTheme();
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);

    return (
        <DropdownMenu
            expanded={open}
            onDismissRequest={() => setOpen(false)}
            color={surface}
        >
            <DropdownMenu.Trigger>
                <Box
                    modifiers={[
                        clip(Shapes.RoundedCorner(RADIUS)),
                        ...(enabled ? [clickable(() => setOpen(true))] : []),
                        ...(testID ? [testIDModifier(testID)] : []),
                    ]}
                >
                    <Surface
                        fill={width === undefined}
                        width={width}
                        direction="row"
                        alignment="center"
                        spacing={SPACING[1]}
                        paddingHorizontal={SPACING[3]}
                        paddingVertical={
                            ((large ? LARGE_HEIGHT : HEIGHT) -
                                ICON_SIZE.large) /
                            2
                        }
                        radius={RADIUS}
                        interactive
                        backgroundColor={surface}
                        borderColor={invalid ? error : fieldBorder}
                        borderWidth={invalid ? 2 : 1}
                        opacity={enabled ? undefined : 0.5}
                    >
                        <Text type="label" color={text}>
                            {selected?.label ?? ""}
                        </Text>
                        <Icon
                            name="expand"
                            size={ICON_SIZE.large}
                            color={muted}
                        />
                    </Surface>
                </Box>
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => {
                            setOpen(false);
                            onChange(option.value);
                        }}
                    >
                        <DropdownMenuItem.Text>
                            <Text
                                type="label"
                                color={option.value === value ? text : muted}
                            >
                                {option.label}
                            </Text>
                        </DropdownMenuItem.Text>
                    </DropdownMenuItem>
                ))}
            </DropdownMenu.Items>
        </DropdownMenu>
    );
};
