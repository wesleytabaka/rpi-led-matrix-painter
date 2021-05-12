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

    private getPaintingInstructionSize(paintingInstruction: PaintingInstruction): {width: number, height: number} {
        switch (paintingInstruction.drawMode){
            case DrawMode.POLYGON: {
                let bounds = (paintingInstruction.points as Point[])
                    .map((value) => {return {minx: value.x, maxx: value.x, miny: value.y, maxy: value.y};})
                    .reduce((prev, curr) => {
                        return {minx: Math.min(prev.minx, curr.minx), maxx: Math.max(prev.maxx, curr.maxx), miny: Math.min(prev.miny, curr.miny), maxy: Math.max(prev.maxy, curr.maxy)};
                    });
                return {width: (bounds.maxx - bounds.minx + 1), height: (bounds.maxy - bounds.miny + 1)};
            }
            case DrawMode.PIXEL: {
                let bounds = (paintingInstruction.points as Point[])
                    .map((value) => {return {minx: value.x, maxx: value.x, miny: value.y, maxy: value.y};})
                    .reduce((prev, curr) => {
                        return {minx: Math.min(prev.minx, curr.minx), maxx: Math.max(prev.maxx, curr.maxx), miny: Math.min(prev.miny, curr.miny), maxy: Math.max(prev.maxy, curr.maxy)};
                    });
                return {width: (bounds.maxx - bounds.minx + 1), height: (bounds.maxy - bounds.miny + 1)};
            }
            case DrawMode.TEXT: {
                let text = (paintingInstruction.text as string);
                let font = this.getFontInstance((((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).font as string), (((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).fontPath as string));
                let textwidth = font.stringWidth(text);
                let textheight = font.height();
                return {width: textwidth, height: textheight};
            }
            case DrawMode.IMAGE: {
                this.getImageInstance(paintingInstruction.imagePath as string)
                    .then((res) => {
                        return {width: res.width, height: res.height};
                    }, (rej) => {
                        return {width: 0, height: 0};
                    });
            }
            default: {
                return {width: paintingInstruction?.width as number, height: paintingInstruction?.height as number};
            }
        }
    }

    private applyEffects(paintingInstruction: PaintingInstruction, canvasSection: CanvasSection): PaintingInstruction | null { // Updates a given PaintingInstruction to transpose over time.
        let newPaintingInstruction = paintingInstruction;
        let dimensions: {width: number, height: number} = this.getPaintingInstructionSize(newPaintingInstruction);
        let delta_x: number = 0;
        let delta_y: number = 0;
        let draw: boolean = true;

        newPaintingInstruction.drawModeOptions?.effects?.forEach((effect) => {
            switch(effect.effectType){
                case EffectType.SCROLLLEFT: {
                    if((this.paintingInstructionCache[paintingInstruction.id].points as Point).x + dimensions.width < canvasSection.x){
                        delta_x = canvasSection.width; // Wrap text to right edge.
                    }
                    else {
                        delta_x = canvasSection.width - ((this.duration / effect.effectOptions.rate) % (dimensions.width + canvasSection.width)); // rate expressed as ms/pixel.
                    }
                    break;
                }
                case EffectType.SCROLLRIGHT: {
                    if((this.paintingInstructionCache[paintingInstruction.id].points as Point).x > (canvasSection.x + canvasSection.width)){
                        delta_x = (dimensions.width); // Wrap text to left edge.
                    }
                    else {
                        delta_x = ((this.duration / effect.effectOptions.rate) % (dimensions.width + canvasSection.width)) - dimensions.width; // rate expressed as ms/pixel.
                    }
                    break;
                }
                case EffectType.SCROLLUP: { 
                    if((this.paintingInstructionCache[paintingInstruction.id].points as Point).y < (canvasSection.y - canvasSection.height)){
                        delta_y = (canvasSection.height); // Wrap text to left edge.
                    }
                    else {
                        delta_y = canvasSection.height + ((this.duration / effect.effectOptions.rate) % (dimensions.height + canvasSection.height)); // rate expressed as ms/pixel.
                    }
                    break;
                }
                case EffectType.SCROLLDOWN: {
                    if((this.paintingInstructionCache[paintingInstruction.id].points as Point).y > (canvasSection.y + canvasSection.height)){
                        delta_y = 0 - (dimensions.height); // Wrap text to left edge.
                    }
                    else {
                        delta_y = ((this.duration / effect.effectOptions.rate) % (dimensions.height + canvasSection.height)) - dimensions.height; // rate expressed as ms/pixel.
                    }
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

        // Apply delta to all Points
        // TODO
        // if(paintingInstruction.id == "asterisk"){
        //     console.log("before", paintingInstruction.points);
        // }
        if(paintingInstruction.drawMode == DrawMode.POLYGON || paintingInstruction.drawMode == DrawMode.PIXEL){
            (newPaintingInstruction.points as Point[]).forEach((point) => {
                point.x += delta_x;
                point.y += delta_y;
            });
        }
        else {
            (newPaintingInstruction.points as Point).x += delta_x;
            (newPaintingInstruction.points as Point).y += delta_y;
        }
        
        // if(paintingInstruction.id == "asterisk"){
        //     console.log("after", newPaintingInstruction.points);
        // }

        return draw ? newPaintingInstruction : null;
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
                            let newPaintingInstruction = this.applyEffects(paintingInstruction, canvasSection);
                            let x = (newPaintingInstruction?.points as Point).x + canvasSection.x;
                            let y = (newPaintingInstruction?.points as Point).y + canvasSection.y;
                            let width = newPaintingInstruction?.width as number;
                            let height = newPaintingInstruction?.height as number;
                            let color = newPaintingInstruction?.color;
                            let fill = newPaintingInstruction?.drawModeOptions?.fill || false;
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
                            let newPaintingInstruction = this.applyEffects(paintingInstruction, canvasSection);
                            let x = (newPaintingInstruction?.points as Point).x + canvasSection.x;
                            let y = (newPaintingInstruction?.points as Point).y + canvasSection.y;
                            let r = (newPaintingInstruction?.width as number) / 2;
                            let color = newPaintingInstruction?.color;
                            let fill = newPaintingInstruction?.drawModeOptions?.fill || false;
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
                            let paintingInstructionWithEffects = this.applyEffects(paintingInstruction, canvasSection);
                            let color = paintingInstructionWithEffects?.color;
                            let fill = paintingInstructionWithEffects?.drawModeOptions?.fill || false;
                            let coordinateArray: number[] = [];
                            (paintingInstructionWithEffects?.points as Point[]).forEach((point: Point) => {
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
                            resolve(paintingInstructionWithEffects as PaintingInstruction);
                            break;
                        }
                        case DrawMode.PIXEL: { 
                            let newPaintingInstruction: PaintingInstruction = this.applyEffects(paintingInstruction, canvasSection) as PaintingInstruction;
                            this.matrix.fgColor(newPaintingInstruction.color);
                            if(newPaintingInstruction != null){
                                (newPaintingInstruction.points as Point[]).forEach((point: Point) => {
                                    this.matrix.setPixel(point.x + canvasSection.x, point.y + canvasSection.y);
                                });
                            }
                            resolve(newPaintingInstruction);
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
                           
                            let paintingInstructionWithEffects = this.applyEffects(paintingInstruction, canvasSection);


                            if(paintingInstructionWithEffects != null){
                                x = (paintingInstructionWithEffects?.points as Point).x + canvasSection.x;
                                y = (paintingInstructionWithEffects?.points as Point).y + canvasSection.y;
                            }
                            else {
                                draw = false;
                            }
                            
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
                                    let newPaintingInstruction: PaintingInstruction = this.applyEffects(paintingInstruction, canvasSection) as PaintingInstruction;
                                    let x = (newPaintingInstruction.points as Point).x + canvasSection.x;
                                    let y = (newPaintingInstruction.points as Point).y + canvasSection.y;

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
