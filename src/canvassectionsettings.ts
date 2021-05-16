import { PaintingInstruction } from "./paintinginstruction";

export interface CanvasSectionSettings {
    name: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    representation: PaintingInstruction[];
    overflow?: boolean;
}
