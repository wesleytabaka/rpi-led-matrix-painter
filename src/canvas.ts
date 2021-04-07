import * as matrix from "../rpi-led-matrix";
import { CanvasSection } from "./canvassection";
import { PaintingInstruction } from "./paintinginstruction";

export class Canvas {
    private canvas: CanvasSection[];
    private matrixOptions: matrix.MatrixOptions;
    private runtimeOptions: matrix.RuntimeOptions;

    constructor(matrixOptions: matrix.MatrixOptions, runtimeOptions: matrix.RuntimeOptions){
        this.canvas = ([] as CanvasSection[]);
        this.matrixOptions = matrixOptions; // May come in handy for display size, etc.
        this.runtimeOptions = runtimeOptions; // May come in handy for display size, etc.
    }

    public getCanvasSections(): CanvasSection[] {
        return this.canvas;
    }

    public getCanvasSection(name: string): CanvasSection | undefined {
        return this.canvas.find((canvasSection: CanvasSection) => {
            return canvasSection.name == name;
        });
    }

    public setCanvasSection(name: string, paintingInstructions: PaintingInstruction[]): void {
        let canvasSection = this.getCanvasSection(name);
        if(canvasSection != undefined){
            canvasSection.setRepresentation(paintingInstructions);
        }
        else {
            throw Error("CanvasSection not found by name, \"" + name + "\"");
        }
    }

    public addCanvasSection(canvasSection: CanvasSection): void {
        this.canvas.push(canvasSection);
    }

}