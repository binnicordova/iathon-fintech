import {Column, Row} from "@expo/ui";
import {
    alpha,
    animateContentSize,
    background,
    clip,
    dropShadow,
    fillMaxWidth,
    padding,
    Shapes,
    size,
    weight,
    width,
} from "@expo/ui/jetpack-compose/modifiers";
import {surfaceModifiers} from "@/theme/surface";
import type {SurfaceProps} from "./Surface";

const CAPSULE_RADIUS = 1000;

/**
 * Compose draws a `border` modifier as a rectangle, so clipping a rounded box
 * around it chops the corners. Instead the box is built the way Material builds
 * an outlined card: an outer rounded layer filled with the border colour, and
 * an inner rounded layer, inset by the border width, that carries the fill.
 * Both curves are real clips, so the outline is as smooth as a native control.
 */
export const Surface = ({
    children,
    direction = "column",
    spacing,
    alignment,
    testID,
    ...spec
}: SurfaceProps) => {
    const Container = direction === "row" ? Row : Column;
    const outlined = Boolean(spec.borderColor && spec.borderWidth);

    if (!outlined) {
        return (
            <Container
                testID={testID}
                spacing={spacing}
                alignment={alignment}
                modifiers={surfaceModifiers(spec)}
            >
                {children}
            </Container>
        );
    }

    const borderWidth = spec.borderWidth ?? 1;
    const radius =
        spec.radius === "capsule" ? CAPSULE_RADIUS : (spec.radius ?? 0);
    const stretches = spec.fill || spec.grow || spec.width != null;

    const outer = [];
    if (spec.opacity != null) {
        outer.push(alpha(spec.opacity));
    }
    if (spec.grow) {
        outer.push(weight(1));
    }
    if (spec.size != null) {
        outer.push(size(spec.size, spec.size));
    } else if (spec.width != null) {
        outer.push(width(spec.width));
    } else if (spec.fill) {
        outer.push(fillMaxWidth());
    }
    if (spec.elevation) {
        outer.push(
            dropShadow(Shapes.RoundedCorner(radius), {
                radius: spec.elevation,
                offsetY: spec.elevation / 3,
                alpha: 0.14,
            })
        );
    }
    outer.push(clip(Shapes.RoundedCorner(radius)));
    outer.push(background(spec.borderColor as string));
    outer.push(padding(borderWidth, borderWidth, borderWidth, borderWidth));
    if (spec.animateOn != null) {
        outer.push(animateContentSize());
    }

    const horizontal = spec.paddingHorizontal ?? spec.padding ?? 0;
    const vertical = spec.paddingVertical ?? spec.padding ?? 0;
    const top = spec.paddingTop ?? vertical;
    const bottom = spec.paddingBottom ?? vertical;

    const inner = [];
    if (stretches) {
        inner.push(fillMaxWidth());
    }
    inner.push(
        clip(
            Shapes.RoundedCorner(
                radius === CAPSULE_RADIUS
                    ? radius
                    : Math.max(0, radius - borderWidth)
            )
        )
    );
    if (spec.backgroundColor) {
        inner.push(background(spec.backgroundColor));
    }
    if (horizontal || top || bottom) {
        inner.push(padding(horizontal, top, horizontal, bottom));
    }

    return (
        <Column modifiers={outer}>
            <Container
                testID={testID}
                spacing={spacing}
                alignment={alignment}
                modifiers={inner}
            >
                {children}
            </Container>
        </Column>
    );
};
