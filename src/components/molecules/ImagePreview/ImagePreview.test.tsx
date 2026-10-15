import {render} from "@testing-library/react-native";
import {ImagePreview} from "./ImagePreview";

describe("ImagePreview", () => {
    it("renders the picked photo at a fixed pixel size", () => {
        const {getByTestId} = render(
            <ImagePreview testID="preview" uri="file:///proof.jpg" />
        );
        const style = getByTestId("preview").props.style;
        const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;

        expect(typeof flat.width).toBe("number");
        expect(flat.height).toBeGreaterThan(0);
    });
});
