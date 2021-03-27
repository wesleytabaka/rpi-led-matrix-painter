import * as matrix from "../rpi-led-matrix";
import { Canvas } from "./canvas";
import { CanvasSection } from "./canvassection";
import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { PaintingInstruction } from "./paintinginstruction";
import { Point } from "./point";
export class Painter {
    private canvas: Canvas;
    private matrix: matrix.LedMatrixInstance;
    private fontCache: matrix.FontInstance[];

    constructor(matrixOptions: matrix.MatrixOptions, runtimeOptions: matrix.RuntimeOptions){
        this.canvas = new Canvas(matrixOptions, runtimeOptions); // May come in handy for display size, etc.
        this.matrix = new matrix.LedMatrix(matrixOptions, runtimeOptions);
        this.fontCache = [] as matrix.FontInstance[];
    }

    public getCanvas(): Canvas{
        return this.canvas;
    };

    public getFontInstance(name: string, path: string): matrix.FontInstance {
        let cachedFont = this.fontCache.find((font: matrix.FontInstance) => {
            font.name() == name && font.path() == path;
        });
        if(cachedFont == undefined){
            // Push font
            cachedFont = new matrix.Font(name, path);
            this.fontCache.push(cachedFont);
        }
        return cachedFont;
    }

    protected paint(): void {
        this.getCanvas().getCanvasSections().forEach((canvasSection: CanvasSection) => {
            canvasSection.get().representation.forEach(paintingInstruction => {
                // Do stuff here.
                switch (paintingInstruction.drawMode){
                    case DrawMode.RECTANGLE: {
                        let x = (paintingInstruction.points as Point).x;
                        let y = (paintingInstruction.points as Point).y;
                        let width = paintingInstruction.width as number;
                        let height = paintingInstruction.height as number;
                        let color = paintingInstruction.drawModeOptions.color;
                        let fill = paintingInstruction.drawModeOptions.fill || false;
                        // console.log("color", color);
                        this.matrix.fgColor(color); // TODO replace with value from DrawModeOptions
                        if(fill){
                            // this.matrix.drawFilledRect(x, y, width, height);
                        }
                        else {
                            this.matrix.drawRect(x, y, width, height);
                        }
                        break;
                    }
                    case DrawMode.CIRCLE: {
                        let x = (paintingInstruction.points as Point).x;
                        let y = (paintingInstruction.points as Point).y;
                        let r = (paintingInstruction.width as number) / 2;
                        let color = paintingInstruction.drawModeOptions.color;
                        let fill = paintingInstruction.drawModeOptions.fill || false;
                        this.matrix.fgColor(color); // TODO replace with value from DrawModeOptions
                        if(fill){
                            // this.matrix.drawFilledCircle(x, y, r);
                        }
                        else {
                            this.matrix.drawCircle(x, y, r);
                        }
                        break;
                    }
                    case DrawMode.ELLIPSE: {
                        console.error("Not implemented.");
                        break;
                    }
                    case DrawMode.POLYGON: {
                        console.error("Not implemented.");
                        break;
                    }
                    case DrawMode.PIXEL: {
                        //this.matrix.fill();
                        // this.matrix.setPixel()
                        console.error("Not implemented.");
                        break;
                    }
                    case DrawMode.TEXT: {
                        let text = (paintingInstruction.text as string);
                        let x = (paintingInstruction.points as Point).x;
                        let y = (paintingInstruction.points as Point).y;
                        let color = (paintingInstruction.drawModeOptions.color);
                        let font = this.getFontInstance((((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).font as string), (((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).fontPath as string));
                        this.matrix.font(font);
                        this.matrix.fgColor(color); // TODO replace with value from DrawModeOptions
                        this.matrix.drawText(text, x, y);
                        break;
                    }
                }
            });
        });
        console.log("Working...");
        this.matrix.sync();
        setTimeout(() => {}, 30000);
    }


    public test(): void {

        let canvasSection = new CanvasSection(1, 1, 1, 10, 10, [
                {
                    drawMode: DrawMode.RECTANGLE,
                    drawModeOptions: {color: 0xFF0000},
                    points: {x: 1, y: 1, z: 1},
                    width: 10,
                    height: 10
                },
                {
                    drawMode: DrawMode.CIRCLE,
                    drawModeOptions: {color: 0x00FF00},
                    points: {x: 1, y: 1, z: 1},
                    width: 10,
                    height: 10
                }
        ], true, 1, "status");

        this.getCanvas().addCanvasSection(canvasSection);
        
        this.paint();

        setTimeout(() => {this.randomColors();}, 1000);

    }

    private randomColors(): void {
        this.getCanvas().getCanvasSection("status")?.setRepresentation([
            {
                drawMode: DrawMode.RECTANGLE,
                drawModeOptions: {color: Math.random() * 16777216},
                points: {x: 1, y: 1, z: 1},
                width: 10,
                height: 10
            },
            {
                drawMode: DrawMode.CIRCLE,
                drawModeOptions: {color: Math.random() * 16777216},
                points: {x: 1, y: 1, z: 1},
                width: 10,
                height: 10
            }
        ]);

        this.paint();

        setTimeout(() => {this.randomColors();}, 100);
    }

}
