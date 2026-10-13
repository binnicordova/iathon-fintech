import {Column, Row} from "@expo/ui";
import {useAtomValue} from "jotai";
import {useEffect, useMemo, useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {AppHeader} from "@/components/organisms/AppHeader/AppHeader";
import {TeamLogin} from "@/components/organisms/TeamLogin/TeamLogin";
import {TeamOrderCard} from "@/components/organisms/TeamOrderCard/TeamOrderCard";
import {Screen} from "@/components/templates/Screen/Screen";
import {useStaffOrders} from "@/hooks/useStaffOrders";
import {useT} from "@/hooks/useT";
import type {OrderStatus} from "@/models/order";
import {api, toApiError} from "@/services/api";
import {shareFile} from "@/services/files";
import {reportError} from "@/services/monitoring";
import {watchWaitingHandoffs} from "@/services/orders";
import {downloadReceipt} from "@/services/receipt";
import {signOutStaff} from "@/services/session";
import {sessionAtom} from "@/stores/session";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

type Filter = "all" | "pending" | "validating" | "approved" | "exported";
const FILTERS: Filter[] = [
    "all",
    "pending",
    "validating",
    "approved",
    "exported",
];

const canExport = (role: string) => role === "operator" || role === "admin";
const canRunFact = (role: string) => role === "billing" || role === "admin";

/**
 * The team's VIEW: replaces searching through chats. The validator checks the
 * photo and the bank and sets the status; the operator marks and exports; Fact
 * results show up on each order.
 */
export default function TeamScreen() {
    const t = useT();
    const {muted} = useTheme();
    const session = useAtomValue(sessionAtom);
    const role = session?.role ?? null;
    const {orders, loading, failed} = useStaffOrders(null);
    const [filter, setFilter] = useState<Filter>("validating");
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        tone: "success" | "error";
        text: string;
    } | null>(null);
    const [waiting, setWaiting] = useState(0);

    useEffect(() => {
        if (!role) {
            return;
        }
        return watchWaitingHandoffs(setWaiting, (error) =>
            reportError(error, "waitingHandoffs")
        );
    }, [role]);

    const counts = useMemo(() => {
        const result: Record<Filter | OrderStatus, number> = {
            all: orders.length,
            pending: 0,
            validating: 0,
            approved: 0,
            exported: 0,
            rejected: 0,
            cancelled: 0,
        };
        for (const order of orders) {
            result[order.status] += 1;
        }
        return result;
    }, [orders]);

    const visible = useMemo(
        () =>
            filter === "all"
                ? orders
                : orders.filter((order) => order.status === filter),
        [orders, filter]
    );

    // A selection only makes sense for orders that are still approved.
    useEffect(() => {
        setSelected((previous) =>
            previous.filter((id) =>
                orders.some(
                    (order) =>
                        order.orderId === id && order.status === "approved"
                )
            )
        );
    }, [orders]);

    const run = async (task: () => Promise<string>) => {
        setBusy(true);
        setMessage(null);
        try {
            setMessage({tone: "success", text: await task()});
        } catch (error) {
            reportError(error, "teamAction");
            const code = toApiError(error).code;
            setMessage({
                tone: "error",
                text:
                    code === "network"
                        ? t("common.offline")
                        : `${t("common.error")} (${code})`,
            });
        } finally {
            setBusy(false);
        }
    };

    if (!session) {
        return (
            <Screen header={<AppHeader />} wide>
                <Text type="label" color={muted}>
                    {t("common.loading")}
                </Text>
            </Screen>
        );
    }

    if (!role) {
        return (
            <Screen header={<AppHeader />} wide>
                <Text type="title">{t("team.title")}</Text>
                {!session.isAnonymous && (
                    <Notice tone="warning">{t("team.noRole")}</Notice>
                )}
                {!session.isAnonymous && (
                    <Button
                        title={t("team.signOut")}
                        variant="outlined"
                        onPress={() => void signOutStaff()}
                    />
                )}
                {session.isAnonymous && (
                    <TeamLogin onSignedIn={() => undefined} />
                )}
            </Screen>
        );
    }

    const factCandidates = orders.filter(
        (order) => order.status === "exported" && order.invoiceStatus === null
    );

    return (
        <Screen header={<AppHeader />} wide>
            <Column spacing={SPACING[1]}>
                <Text type="title">{t("team.title")}</Text>
                <Text type="caption" color={muted} testID="team-signed-in">
                    {t("team.signedInAs", {email: session.email ?? "", role})}
                </Text>
                <Text type="caption" color={muted}>
                    {t("team.testMode")}
                </Text>
                {waiting > 0 && (
                    <Text type="label" testID="team-queue">
                        {t("team.queue", {n: waiting})}
                    </Text>
                )}
            </Column>

            <Row spacing={SPACING[2]} alignment="center">
                {FILTERS.map((entry) => (
                    <Chip
                        key={entry}
                        testID={`filter-${entry}`}
                        tone="accent"
                        selected={filter === entry}
                        label={`${t(`team.tab.${entry}`)} ${counts[entry]}`}
                        onPress={() => setFilter(entry)}
                    />
                ))}
            </Row>

            {(canExport(role) || canRunFact(role)) && (
                <Card spacing={SPACING[2]}>
                    {canExport(role) && (
                        <>
                            <Text type="caption" color={muted}>
                                {t("team.selectHint")}
                            </Text>
                            <Button
                                testID="team-export"
                                title={`${t("team.markExport", {n: selected.length})} · ${t("team.export")}`}
                                disabled={busy || selected.length === 0}
                                onPress={() =>
                                    run(async () => {
                                        const result = await api.exportOrders({
                                            orderIds: selected,
                                        });
                                        await shareFile({
                                            filename: result.filename,
                                            mimeType: "text/csv",
                                            content: result.csv,
                                        });
                                        setSelected([]);
                                        return t("team.exportDone", {
                                            n: result.count,
                                        });
                                    })
                                }
                            />
                        </>
                    )}
                    {canRunFact(role) && (
                        <Button
                            testID="team-fact"
                            variant="outlined"
                            title={`${t("team.runFact")} (${factCandidates.length})`}
                            disabled={busy || factCandidates.length === 0}
                            onPress={() =>
                                run(async () => {
                                    const {results} = await api.runFact({
                                        orderIds: factCandidates.map(
                                            (order) => order.orderId
                                        ),
                                    });
                                    const count = (outcome: string) =>
                                        results.filter(
                                            (r) => r.outcome === outcome
                                        ).length;
                                    return t("team.factDone", {
                                        ok: count("accepted"),
                                        skipped: count("skipped"),
                                        aside:
                                            count("set-aside") +
                                            count("rejected"),
                                    });
                                })
                            }
                        />
                    )}
                </Card>
            )}

            {message && (
                <Notice tone={message.tone} testID="team-message">
                    {message.text}
                </Notice>
            )}
            {failed && <Notice tone="error">{t("common.error")}</Notice>}
            {!loading && visible.length === 0 && (
                <Text type="label" color={muted} testID="team-empty">
                    {t("team.empty")}
                </Text>
            )}

            {visible.map((order) => (
                <TeamOrderCard
                    key={order.orderId}
                    order={order}
                    role={role}
                    busy={busy}
                    selected={selected.includes(order.orderId)}
                    onToggle={(id) =>
                        setSelected((previous) =>
                            previous.includes(id)
                                ? previous.filter((entry) => entry !== id)
                                : [...previous, id]
                        )
                    }
                    onReview={(id, decision, reason) =>
                        void run(async () => {
                            await api.reviewOrder({
                                orderId: id,
                                decision,
                                ...(reason ? {reason} : {}),
                            });
                            return `${id}: ${decision === "approve" ? t("team.approve") : t("team.reject")}`;
                        })
                    }
                    onReceipt={(id) =>
                        void run(async () => {
                            await downloadReceipt(id);
                            return id;
                        })
                    }
                />
            ))}

            <Button
                testID="team-sign-out"
                variant="text"
                title={t("team.signOut")}
                onPress={() => void signOutStaff()}
            />
        </Screen>
    );
}
