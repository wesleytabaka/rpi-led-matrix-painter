import { CanvasSectionSettings } from "./canvassectionsettings";
import { PaintingInstruction } from "./paintinginstruction";

export class CanvasSection implements CanvasSectionSettings {
    name: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    representation: PaintingInstruction[];
    overflow?: boolean;

    constructor(name: string, x: number, y: number, z: number, width: number, height: number, representation?: PaintingInstruction[], overflow?: boolean){
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.width = width;
        this.height = height;
        this.representation = representation || ([] as PaintingInstruction[]);
        this.overflow = overflow || true;
    }

    public get(): CanvasSection {
        return this;
    }

    public setRepresentation(paintingInstructions: PaintingInstruction[]){
        this.representation = paintingInstructions;
    }

}