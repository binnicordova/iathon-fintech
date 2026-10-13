import {Column} from "@expo/ui";
import {useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {Card} from "@/components/molecules/Card/Card";
import {Field} from "@/components/molecules/Field/Field";
import {Notice} from "@/components/molecules/Notice/Notice";
import {useT} from "@/hooks/useT";
import {reportError} from "@/services/monitoring";
import {signInStaff} from "@/services/session";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type TeamLoginProps = {
    onSignedIn: () => void;
};

/** Staff sign in with their team email; clients never see a login. */
export const TeamLogin = ({onSignedIn}: TeamLoginProps) => {
    const t = useT();
    const {muted} = useTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    const submit = async () => {
        setBusy(true);
        setFailed(false);
        try {
            await signInStaff(email, password);
            onSignedIn();
        } catch (error) {
            reportError(error, "staffLogin");
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card spacing={SPACING[4]}>
            <Column spacing={SPACING[1]}>
                <Text type="subtitle">{t("team.login")}</Text>
                <Text type="caption" color={muted}>
                    {t("team.loginHint")}
                </Text>
            </Column>
            <Field label={t("team.email")} testID="field-staff-email">
                <TextField
                    testID="staff-email"
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    onChangeText={setEmail}
                />
            </Field>
            <Field label={t("team.password")} testID="field-staff-password">
                <TextField
                    testID="staff-password"
                    value={password}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    returnKeyType="go"
                    onChangeText={setPassword}
                    onSubmitEditing={() => void submit()}
                />
            </Field>
            {failed && <Notice tone="error">{t("team.badLogin")}</Notice>}
            <Button
                testID="staff-sign-in"
                title={t("team.signIn")}
                disabled={
                    busy || email.trim().length === 0 || password.length === 0
                }
                onPress={submit}
            />
        </Card>
    );
};
