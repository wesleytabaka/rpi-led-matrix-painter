import { PaintingInstruction } from "./paintinginstruction";

export class CanvasSection {
    id?: number;
    name?: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    representation: PaintingInstruction[];
    overflow?: boolean;

    constructor(x: number, y: number, z: number, width: number, height: number, representation?: PaintingInstruction[], overflow?: boolean, id?: number, name?: string){
        this.id = id;
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