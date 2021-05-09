import * as matrix from "../rpi-led-matrix";
import { Canvas } from "./canvas";
import { CanvasSection } from "./canvassection";
import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { PaintingInstruction } from "./paintinginstruction";
import { Point } from "./point";
import { EffectType } from "./effecttype";
import { Effect } from ".";
import { Image } from "./image";
import Jimp from "jimp";
import { PaintingInstructionCache } from "./paintinginstructioncache";

export class Painter {
    private canvas: Canvas;
    private matrix: matrix.LedMatrixInstance;
    private fontCache: matrix.FontInstance[];
    private imageCache: Image[];
    private paintingInstructionCache: PaintingInstructionCache; // Handles effect updates
    private startTime: Date;
    private currentTime: Date;
    private duration: number; // milliseconds

    constructor(matrixOptions: matrix.MatrixOptions, runtimeOptions: matrix.RuntimeOptions){
        this.canvas = new Canvas(matrixOptions, runtimeOptions); // May come in handy for display size, etc.
        this.matrix = new matrix.LedMatrix(matrixOptions, runtimeOptions);
        this.fontCache = [] as matrix.FontInstance[];
        this.imageCache = [] as Image[];
        this.paintingInstructionCache = {} as PaintingInstructionCache;
        this.startTime = new Date();
        this.currentTime = new Date();
        this.duration = this.currentTime.getTime() - this.startTime.getTime();
    }

    private tick(): void {
        this.currentTime = new Date();
        this.duration = this.currentTime.getTime() - this.startTime.getTime();
    }

    public resetClock(): void { // Use to start effects from "zero".
        this.startTime = new Date();
        this.tick();
    }

    public getCanvas(): Canvas{
        return this.canvas;
    };

    public getFontInstance(name: string, path: string): matrix.FontInstance {
        let cachedFont = this.fontCache.find((font: matrix.FontInstance) => {
            return font.name() == name && font.path() == path;
        });
        if(cachedFont == undefined){
            // Push font
            cachedFont = new matrix.Font(name, path);
            this.fontCache.push(cachedFont);
        }
        return cachedFont;
    }

    public getImageInstance(imagePath: string): Promise<Image> {
        return new Promise<Image>((resolve, reject) => {
            let cachedImage = this.imageCache.find((image: Image) => {
                return image.path == imagePath;
            });
            if(cachedImage != undefined){
                resolve(cachedImage);
            }
            if(cachedImage == undefined){
                let content: number[][];
                Jimp.read(imagePath)
                    .then((res: Jimp) => {
                        let width = res.getWidth();
                        let height = res.getHeight();
                        content = Array(width);
                        for(let x = 1; x <= width; x++){
                            content[x - 1] = Array(height);
                            for(let y = 1; y <= width; y++){
                                content[x - 1][y - 1] = (res.getPixelColor(x, y) >>> 0); // Convert to unsigned 32-bit int.
                            }
                        }
                        cachedImage = {
                            path: imagePath,
                            width: width,
                            height: height,
                            content: content
                        } as Image;
    
                        this.imageCache.push(cachedImage);
                        resolve(cachedImage);
                    }, (rej: any) => {
                        reject(rej);
                        console.log("Error reading image.");
                        throw Error("Error reading image.");
                    });
            }
        });
        
    }

    protected fillBlankCanvasSections(): void {
        // TODO will probably have to come back here to fix multiple boards
        let width = this.matrix.width();
        let height = this.matrix.height();
        let map: boolean[][] = [[]];

        for(let y = 0; y < height; y++){
            map[y] = Array(width);
            map[y].fill(false, 0, width);
        }
        

        let sections: CanvasSection[] = this.getCanvas().getCanvasSections();

        // TODO There's probably a better implementation for this, but for now...
        // Loop through sections and mark all pixels that are touched.

        this.matrix.fgColor(0x000000);

        sections.forEach(section => {
            for(let y = section.y; y < section.y + section.height; y++){
                map[y].fill(true, section.x, section.x + section.width);
            }
        });

        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                if(!map[y][x]){
                    this.matrix.setPixel(x, y);
                }
            }
        }

    }

    public paint(): void {
        // How can I crop the CanvasSection if there's overflow?
        // How about before we draw each CanvasSection we do a fill with black on the section?  It would work for the next section being drawn...
        // In other words, if there are empty portions of the canvas, we should fill them in with black as well.  Some clever maths will help.
        this.tick();
        this.matrix.clear();

        let instructionPromises: Promise<PaintingInstruction>[] = [] as Promise<PaintingInstruction>[];

        this.getCanvas().getCanvasSections().sort((a, b) => {return a.z - b.z;}).forEach((canvasSection: CanvasSection) => {
            // Blank out the CanvasSection.
            this.matrix.fgColor(0x000000);
            this.matrix.fill(canvasSection.x, canvasSection.y, canvasSection.x + canvasSection.width - 1, canvasSection.y + canvasSection.height - 1);
            // this.matrix.sync();

            // TODO Use promise.all() so we know everything's been drawn to the screen.
            canvasSection.get().representation.forEach(paintingInstruction => {
                instructionPromises.push(new Promise((resolve, reject) => {
                    if(this.paintingInstructionCache[paintingInstruction.id] == undefined){
                        this.paintingInstructionCache[paintingInstruction.id] = paintingInstruction;
                    } 

                    // Do stuff here.
                    switch (paintingInstruction.drawMode){
                        case DrawMode.RECTANGLE: {
                            let x = (paintingInstruction.points as Point).x + canvasSection.x;
                            let y = (paintingInstruction.points as Point).y + canvasSection.y;
                            let width = paintingInstruction.width as number;
                            let height = paintingInstruction.height as number;
                            let color = paintingInstruction.color;
                            let fill = paintingInstruction.drawModeOptions?.fill || false;
                            this.matrix.fgColor(color!);
                            if(fill){
                                this.matrix.drawFilledRect(x, y, width, height);
                            }
                            else {
                                this.matrix.drawRect(x, y, width, height);
                            }
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.CIRCLE: {
                            let x = (paintingInstruction.points as Point).x + canvasSection.x;
                            let y = (paintingInstruction.points as Point).y + canvasSection.y;
                            let r = (paintingInstruction.width as number) / 2;
                            let color = paintingInstruction.color;
                            let fill = paintingInstruction.drawModeOptions?.fill || false;
                            this.matrix.fgColor(color!); 
                            if(fill){
                                this.matrix.drawFilledCircle(x, y, r);
                            }
                            else {
                                this.matrix.drawCircle(x, y, r);
                            }
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.ELLIPSE: {
                            console.error("Not implemented.");
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.POLYGON: {
                            let color = paintingInstruction.color;
                            let fill = paintingInstruction.drawModeOptions?.fill || false;
                            let coordinateArray: number[] = [];
                            (paintingInstruction.points as Point[]).forEach((point: Point) => {
                                coordinateArray.push(point.x + canvasSection.x);
                                coordinateArray.push(point.y + canvasSection.y);
                            });
                            this.matrix.fgColor(color!);
                            if(fill){
                                this.matrix.drawFilledPolygon(coordinateArray);
                            }
                            else {
                                this.matrix.drawPolygon(coordinateArray);
                            }
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.PIXEL: {
                            this.matrix.fgColor(paintingInstruction.color);
                            (paintingInstruction.points as Point[]).forEach((point: Point) => {
                                this.matrix.setPixel(point.x + canvasSection.x, point.y + canvasSection.y);
                            });
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.TEXT: {
                            let text = (paintingInstruction.text as string);
                            let x = (paintingInstruction.points as Point).x + canvasSection.x;
                            let y = (paintingInstruction.points as Point).y + canvasSection.y;
                            let color = (paintingInstruction.color);
                            let font = this.getFontInstance((((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).font as string), (((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).fontPath as string));
                            let textwidth = font.stringWidth(text);
                            let textheight = font.height();
                            let draw: boolean = true;
                            
                            paintingInstruction.drawModeOptions?.effects?.forEach((effect) => {
                                switch(effect.effectType){
                                    case EffectType.SCROLLLEFT: {
                                        if((this.paintingInstructionCache[paintingInstruction.id].points as Point).x + textwidth < canvasSection.x){
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).x = (paintingInstruction.points as Point).x + canvasSection.width; // Wrap text to right edge.
                                        }
                                        else {
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).x = x - ((this.duration / effect.effectOptions.rate) % (textwidth + canvasSection.width)) + canvasSection.width; // rate expressed as ms/pixel.
                                        }
                                        x = (this.paintingInstructionCache[paintingInstruction.id].points as Point).x;
                                        break;
                                    }
                                    case EffectType.SCROLLRIGHT: {
                                        if((this.paintingInstructionCache[paintingInstruction.id].points as Point).x > (canvasSection.x + canvasSection.width)){
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).x = (paintingInstruction.points as Point).x - (textwidth); // Wrap text to left edge.
                                        }
                                        else {
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).x = x + ((this.duration / effect.effectOptions.rate) % (textwidth + canvasSection.width)) - textwidth; // rate expressed as ms/pixel.
                                        }
                                        x = (this.paintingInstructionCache[paintingInstruction.id].points as Point).x;
                                        break;
                                    }
                                    case EffectType.SCROLLUP: { 
                                        if((this.paintingInstructionCache[paintingInstruction.id].points as Point).y < (canvasSection.y - canvasSection.height)){
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).y = (paintingInstruction.points as Point).y + (canvasSection.height); // Wrap text to left edge.
                                        }
                                        else {
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).y = y - ((this.duration / effect.effectOptions.rate) % (textheight + canvasSection.height)) + canvasSection.height; // rate expressed as ms/pixel.
                                        }
                                        y = (this.paintingInstructionCache[paintingInstruction.id].points as Point).y;
                                        break;
                                    }
                                    case EffectType.SCROLLDOWN: {
                                        if((this.paintingInstructionCache[paintingInstruction.id].points as Point).y > (canvasSection.y + canvasSection.height)){
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).y = (paintingInstruction.points as Point).y - (textheight); // Wrap text to left edge.
                                        }
                                        else {
                                            (this.paintingInstructionCache[paintingInstruction.id].points as Point).y = y + ((this.duration / effect.effectOptions.rate) % (textheight + canvasSection.height)) - textheight; // rate expressed as ms/pixel.
                                        }
                                        y = (this.paintingInstructionCache[paintingInstruction.id].points as Point).y;
                                        break;
                                    }
                                    case EffectType.BLINK: {
                                        if(Math.floor(this.duration / effect.effectOptions.rate) % 2 == 1){
                                            draw = false;
                                        }
                                        break;
                                    }
                                }
                            });

                            if(draw){
                                this.matrix.font(font);
                                this.matrix.fgColor(color!);
                                this.matrix.drawText(text, x, y);
                            }
                            resolve(paintingInstruction);
                            break;
                        }
                        case DrawMode.IMAGE: {
                            // Loop through image points and use SetPixel.
                            this.getImageInstance(paintingInstruction.imagePath!)
                                .then((res: Image) => {
                                    
                                    let imageInstance: Image = res;
                                    let x = (paintingInstruction.points as Point).x + canvasSection.x;
                                    let y = (paintingInstruction.points as Point).y + canvasSection.y;

                                    for(let img_y = 0; img_y < imageInstance.height; img_y++){
                                        for(let img_x = 0; img_x < imageInstance.width; img_x++){
                                            if((imageInstance.content[img_x][img_y] & 0x000000FF) != 0){ // Alpha 0 is not drawn.
                                                this.matrix.fgColor(imageInstance.content[img_x][img_y] >>> 8);
                                                this.matrix.setPixel(x + img_x, y + img_y);
                                            }
                                        }
                                    }
                                    // this.matrix.sync();
                                }, (rej) => {
                                    console.log(rej);
                                });
                                resolve(paintingInstruction);
                                break;
                        }

                        // case DrawMode.BUFFER: {
                        //     this.matrix.drawBuffer(paintingInstruction.buffer!, paintingInstruction.width!, paintingInstruction.height!); // TODO better definition.
                        // }
                    }
                }));
            });
            // Debugging...
            // this.matrix.fgColor(0x00FF00); // Draw bound on CanvasSection
            // this.matrix.setPixel(canvasSection.x, canvasSection.y);
            // this.matrix.setPixel(canvasSection.x + canvasSection.width - 1, canvasSection.y);
            // this.matrix.setPixel(canvasSection.x + canvasSection.width - 1, canvasSection.y + canvasSection.height - 1);
            // this.matrix.setPixel(canvasSection.x, canvasSection.y + canvasSection.height - 1);
        });

        Promise.all(instructionPromises)
            .then((res) => {
                this.fillBlankCanvasSections();
                this.matrix.sync();
            }, (rej) => {
                this.fillBlankCanvasSections();
                this.matrix.sync();
            });        
    }

}
