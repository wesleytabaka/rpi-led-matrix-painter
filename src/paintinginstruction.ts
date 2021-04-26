import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { Point } from "./point";

export interface PaintingInstruction {
    id: string,
    drawMode: DrawMode,
    drawModeOptions: DrawModeOption,
    points: Point | Point[],
    width?: number,
    height?: number,
    layer?: number,
    text?: string,
    imagePath?: string,
    buffer?: Buffer
}
