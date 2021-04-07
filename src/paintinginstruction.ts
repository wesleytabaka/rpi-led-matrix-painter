import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { Point } from "./point";

export interface PaintingInstruction {
    drawMode: DrawMode,
    drawModeOptions: DrawModeOption,
    points: Point | Point[],
    width?: number,
    height?: number,
    layer?: number,
    text?: string
}