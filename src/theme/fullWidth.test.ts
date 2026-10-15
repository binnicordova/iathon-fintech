import {fullWidth} from "./fullWidth";
import {fullWidth as fullWidthAndroid} from "./fullWidth.android";

describe("fullWidth", () => {
    it("keeps the percentage style on iOS and web", () => {
        expect(fullWidth()).toEqual({style: {width: "100%"}});
        expect(fullWidth({paddingLeft: 8})).toEqual({
            style: {width: "100%", paddingLeft: 8},
        });
    });

    describe("on Android", () => {
        it("never passes a string width: Compose takes an Int and the app dies on launch", () => {
            const props = fullWidthAndroid({paddingLeft: 8});

            expect(props.style).toBeUndefined();
            expect(JSON.stringify(props)).not.toContain("100%");
        });

        it("asks for the full width with a modifier", () => {
            const {modifiers} = fullWidthAndroid();

            expect(modifiers?.map((m) => m.$type)).toEqual(["fillMaxWidth"]);
        });

        it("turns the paddings into one padding modifier", () => {
            const {modifiers} = fullWidthAndroid({
                paddingTop: 12,
                paddingBottom: 16,
                paddingLeft: 16,
                paddingRight: 16,
            });

            expect(modifiers).toHaveLength(2);
            expect(modifiers?.[1]).toMatchObject({
                $type: "padding",
                start: 16,
                top: 12,
                end: 16,
                bottom: 16,
            });
        });

        it("falls back from the specific paddings to the shorthand", () => {
            const {modifiers} = fullWidthAndroid({
                padding: 4,
                paddingHorizontal: 10,
                paddingRight: 0,
            });

            expect(modifiers?.[1]).toMatchObject({
                start: 10,
                top: 4,
                end: 0,
                bottom: 4,
            });
        });
    });
});
