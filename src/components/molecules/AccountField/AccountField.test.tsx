import {render} from "@testing-library/react-native";
import type {SavedAccount} from "@/models/client";
import {AccountField} from "./AccountField";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// The real field needs the native text state, which Jest does not provide.
jest.mock("@/components/atoms/TextField/TextField", () => ({
    TextField: ({testID}: {testID?: string}) => {
        const {View} = require("react-native");
        return <View testID={testID} />;
    },
}));

const saved: SavedAccount[] = [
    {
        id: "BCP|19112345678012",
        bank: "BCP",
        accountNumber: "19112345678012",
        currency: "PEN",
    },
];

const renderField = (props: Partial<Parameters<typeof AccountField>[0]> = {}) =>
    render(
        <AccountField
            testID="dest"
            currency="PEN"
            saved={saved}
            bank=""
            accountNumber=""
            onChange={jest.fn()}
            {...props}
        />
    );

describe("AccountField", () => {
    it("shows only the saved-accounts menu when the client has accounts", () => {
        const {queryByTestId} = renderField();

        expect(queryByTestId("dest")).toBeTruthy();
        expect(queryByTestId("dest-number")).toBeNull();
    });

    it("keeps the inputs hidden while a saved account is selected", () => {
        const {queryByTestId} = renderField({
            bank: "BCP",
            accountNumber: "19112345678012",
        });

        expect(queryByTestId("dest-number")).toBeNull();
    });

    it("asks for bank and number when nothing is saved", () => {
        const {queryByTestId} = renderField({saved: []});

        expect(queryByTestId("dest-number")).toBeTruthy();
    });

    it("opens the inputs for an account that is not in the list", () => {
        const {queryByTestId} = renderField({
            bank: "Interbank",
            accountNumber: "898-3001234567",
        });

        expect(queryByTestId("dest-number")).toBeTruthy();
    });
});
