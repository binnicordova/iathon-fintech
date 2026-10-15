import type {UniversalStyle} from "@expo/ui";
import type {ModifierConfig} from "@expo/ui/jetpack-compose/modifiers";

/** The paddings a full-width row can carry: numbers only, the same on every platform. */
export type FullWidthPadding = {
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
};

/** Spread onto a Row, Column or ScrollView: `<Row {...fullWidth()} />`. */
export type FullWidthProps = {
    style?: UniversalStyle;
    modifiers?: ModifierConfig[];
};
