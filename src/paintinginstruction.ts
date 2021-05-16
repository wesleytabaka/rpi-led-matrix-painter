import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { Point } from "./point";

export interface PaintingInstruction {
    id: string,
    drawMode: DrawMode,
    points: Point | Point[],
    color: number,
    layer: number,
    drawModeOptions?: DrawModeOption,
    width?: number,
    height?: number,
    text?: string,
    imagePath?: string,
    buffer?: Buffer
}