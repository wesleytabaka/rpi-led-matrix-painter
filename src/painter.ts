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

    protected paint(): void {
        // How can I crop the CanvasSection if there's overflow?
        // How about before we draw each CanvasSection we do a fill with black on the section?  It would work for the next section being drawn...
        // In other words, if there are empty portions of the canvas, we should fill them in with black as well.  Some clever maths will help.
        this.tick();
        this.matrix.clear();
        this.getCanvas().getCanvasSections().sort((a, b) => {return a.z - b.z;}).forEach((canvasSection: CanvasSection) => {
            // Blank out the CanvasSection.
            this.matrix.fgColor(0x000000);
            this.matrix.fill(canvasSection.x, canvasSection.y, canvasSection.x + canvasSection.width - 1, canvasSection.y + canvasSection.height - 1);
            // this.matrix.sync();


            // TODO Use promise.all() so we know everything's been drawn to the screen.
            canvasSection.get().representation.forEach(paintingInstruction => {
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
                        let color = paintingInstruction.drawModeOptions.color;
                        let fill = paintingInstruction.drawModeOptions.fill || false;
                        this.matrix.fgColor(color!);
                        if(fill){
                            this.matrix.drawFilledRect(x, y, width, height);
                        }
                        else {
                            this.matrix.drawRect(x, y, width, height);
                        }
                        break;
                    }
                    case DrawMode.CIRCLE: {
                        let x = (paintingInstruction.points as Point).x + canvasSection.x;
                        let y = (paintingInstruction.points as Point).y + canvasSection.y;
                        let r = (paintingInstruction.width as number) / 2;
                        let color = paintingInstruction.drawModeOptions.color;
                        let fill = paintingInstruction.drawModeOptions.fill || false;
                        this.matrix.fgColor(color!); 
                        if(fill){
                            this.matrix.drawFilledCircle(x, y, r);
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
                        let color = paintingInstruction.drawModeOptions.color;
                        let fill = paintingInstruction.drawModeOptions.fill || false;
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
                        
                        break;
                    }
                    case DrawMode.PIXEL: {
                        this.matrix.fgColor(paintingInstruction.drawModeOptions.color!);
                        (paintingInstruction.points as Point[]).forEach((point: Point) => {
                            this.matrix.setPixel(point.x + canvasSection.x, point.y + canvasSection.y);
                        });
                        break;
                    }
                    case DrawMode.TEXT: {
                        let text = (paintingInstruction.text as string);
                        let x = (paintingInstruction.points as Point).x + canvasSection.x;
                        let y = (paintingInstruction.points as Point).y + canvasSection.y;
                        let color = (paintingInstruction.drawModeOptions.color);
                        let font = this.getFontInstance((((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).font as string), (((paintingInstruction as PaintingInstruction).drawModeOptions as DrawModeOption).fontPath as string));
                        let textwidth = font.stringWidth(text);
                        let textheight = font.height();
                        
                        paintingInstruction.drawModeOptions.effects?.forEach((effect) => {
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
                            }
                        });

                        this.matrix.font(font);
                        this.matrix.fgColor(color!);
                        this.matrix.drawText(text, x, y);
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
                                this.matrix.sync();
                            }, (rej) => {
                                console.log(rej);
                            });
                            break;
                    }
                    // case DrawMode.BUFFER: {
                    //     this.matrix.drawBuffer(paintingInstruction.buffer!, paintingInstruction.width!, paintingInstruction.height!); // TODO better definition.
                    // }
                }
            });
            // Debugging...
            // this.matrix.fgColor(0x00FF00); // Draw bound on CanvasSection
            // this.matrix.setPixel(canvasSection.x, canvasSection.y);
            // this.matrix.setPixel(canvasSection.x + canvasSection.width - 1, canvasSection.y);
            // this.matrix.setPixel(canvasSection.x + canvasSection.width - 1, canvasSection.y + canvasSection.height - 1);
            // this.matrix.setPixel(canvasSection.x, canvasSection.y + canvasSection.height - 1);
        });

        
        this.fillBlankCanvasSections();
        this.matrix.sync();
    }


    public test(): void {

        let canvasSection = new CanvasSection(0, 0, 1, 73, 13, [ // Actual width is 59.
                // {
                //     drawMode: DrawMode.RECTANGLE,
                //     drawModeOptions: {color: 0xFF0000},
                //     points: {x: 1, y: 1, z: 1},
                //     width: 10,
                //     height: 10
                // },
                // {
                //     drawMode: DrawMode.CIRCLE,
                //     drawModeOptions: {color: 0x00FF00},
                //     points: {x: 1, y: 1, z: 1},
                //     width: 10,
                //     height: 10
                // },
                // {
                //     drawMode: DrawMode.POLYGON,
                //     drawModeOptions: {color: 0x00FF00},
                //     points: [
                //         {x: 20, y: 1, z: 1},
                //         {x: 29, y: 10, z: 1},
                //         {x: 11, y: 10, z: 1}
                //     ]
                //     // width: 10,
                //     // height: 10
                // }
        ], true, 1, "clock");

        this.getCanvas().addCanvasSection(canvasSection);

        this.getCanvas().addCanvasSection(new CanvasSection(0, 16, 2, 27, 7, [], true, 2, "icons"));

        this.getCanvas().addCanvasSection(new CanvasSection(45, 0, 0, 32, 32, [], true, 3, "bottomlayer")); // Try to overlap with clock.

        // this.getCanvas().addCanvasSection(new CanvasSection(96, 0, 3, 32, 32, [], true, 4, "image"));
        this.getCanvas().addCanvasSection(new CanvasSection(0, 32, 3, 32, 32, [], true, 4, "image"));

        this.getCanvas().addCanvasSection(new CanvasSection(32, 32, 4, 32, 16, [], true, 5, "scrollTest"));
        
        this.paint();

        setTimeout(() => {this.randomColors();}, 1000);

    }

    private leadingZeroes(num: number, digits: number): string {
        return ("0".repeat(digits) + num.toString()).substr(num.toString().length, digits + 1);
    }

    public randomColors(): void {
        const date: Date = new Date();
        const timeString: string = this.leadingZeroes(date.getHours(), 2) + ":" + this.leadingZeroes(date.getMinutes(), 2) + ":" + this.leadingZeroes(date.getSeconds(), 2) + "." + this.leadingZeroes(date.getMilliseconds(), 3);
        const dateString: string = date.getFullYear() + '-' + this.leadingZeroes(date.getMonth() + 1, 2) + '-' + this.leadingZeroes(date.getDate(), 2);
        this.getCanvas().getCanvasSection("clock")?.setRepresentation([
            {
                id: "time",
                drawMode: DrawMode.TEXT,
                drawModeOptions: {color: 0x800000, fill: true, font: "5x7", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/5x7.bdf"},
                points: {x: 0, y:0, z: 1},
                text: timeString,
                layer: 5
                // width: 10,
                // height: 10
            }, {
                id: "date",
                drawMode: DrawMode.TEXT,
                drawModeOptions: {color: 0x800000, fill: false, font: "4x6", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf"},
                points: {x: 0, y: 8, z: 1},
                text: dateString,
                layer: 6
                // width: 10,
                // height: 10
            }]);
            // {
            //     drawMode: DrawMode.RECTANGLE,
            //     drawModeOptions: {color: Math.random() * 16777216, fill: true},
            //     points: {x: 1, y: 1, z: 1},
            //     width: 10,
            //     height: 10,
            //     layer: 1
            // }, {
            //     drawMode: DrawMode.CIRCLE,
            //     drawModeOptions: {color: Math.random() * 16777216, fill: true},
            //     points: {x: 7, y: 18, z: 1},
            //     width: 10,
            //     height: 10,
            //     layer: 2
            // }, 
            // {
            //     drawMode: DrawMode.POLYGON,
            //     drawModeOptions: {color: 0x800000, fill: true},
            //     points: [
            //         {x: 20, y: 17, z: 1},
            //         {x: 29, y: 26, z: 1},
            //         {x: 11, y: 26, z: 1}
            //     ],
            //     layer: 3
            //     // width: 10,
            //     // height: 10
            // },
	    // // Star:
	
        //     {
        //         drawMode: DrawMode.POLYGON,
        //         drawModeOptions: {color: 0x808000, fill: true},
        //         points: [
        //             // {x: 40, y: 16, z: 1},
        //             // {x: 41, y: 17, z: 1},
        //             // {x: 43, y: 18, z: 1},
        //             // {x: 41, y: 20, z: 1},
        //             // {x: 42, y: 22, z: 1},
        //             // {x: 40, y: 21, z: 1},
        //             // {x: 38, y: 22, z: 1},
        //             // {x: 39, y: 20, z: 1},
        //             // {x: 37, y: 18, z: 1},
        //             // {x: 39, y: 18, z: 1}
        //             {x: 40, y: 17, z: 0},
        //             {x: 41, y: 19, z: 0},
        //             {x: 43, y: 19, z: 0},
        //             {x: 41, y: 21, z: 0},
        //             {x: 42, y: 23, z: 0},
        //             {x: 40, y: 22, z: 0},
        //             {x: 38, y: 23, z: 0},
        //             {x: 39, y: 21, z: 0},
        //             {x: 37, y: 19, z: 0},
        //             {x: 39, y: 19, z: 0}
        //         ],
        //         layer: 3
        //         // width: 10,
        //         // height: 10
	    // },
	
		
        //     // Green check mark.
        //     {
        //         drawMode: DrawMode.POLYGON,
        //         drawModeOptions: {color: 0x008000, fill: true},
        //         points: [
        //             {x: 20, y: 17, z: 1},
        //             {x: 22, y: 19, z: 1},
        //             {x: 14, y: 27, z: 1},
        //             {x: 10, y: 23, z: 1},
        //             {x: 12, y: 21, z: 1},
        //             {x: 14, y: 23, z: 1}
        //         ],
        //         layer: 3
        //         // width: 10,
        //         // height: 10
        //     },

        //     // Fractional slope polygon
        //     {
        //         drawMode: DrawMode.POLYGON,
        //         drawModeOptions: {color: 0x000080, fill: true},
        //         points: [
        //             {x: 2, y: 2, z: 1},
        //             {x: 4, y: 11, z: 1},
        //             {x: 0, y: 11, z: 1}
        //         ],
        //         layer: 4
        //     },
        //     // Polygon with flat line
        //     {
        //         drawMode: DrawMode.POLYGON,
        //         drawModeOptions: {color: 0x804000, fill: true},
        //         points: [
        //             {x: 0, y: 16, z: 1},
        //             {x: 4, y: 16, z: 1},
        //             {x: 6, y: 12, z: 1},
        //             {x: 8, y: 16, z: 1},
        //             {x: 6, y: 20, z: 1}
        //         ],
        //         layer: 4
        //     },
        //     // Rectangle polygon
        //     {
        //         drawMode: DrawMode.POLYGON,
        //         drawModeOptions: {color: 0x800080, fill: true},
        //         points: [
        //             {x: 46, y: 16, z: 1},
        //             {x: 52, y: 16, z: 1},
        //             {x: 52, y: 28, z: 1},
        //             {x: 46, y: 28, z: 1}
        //         ],
        //         layer: 4
        //     },
        this.getCanvas().getCanvasSection("icons")?.setRepresentation([
            // Red "X"
            { //x -4, y -16
                id: "x",
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x800000, fill: true, },
                points: [
                    {x: 1, y: 0, z: 1}, // 
                    {x: 3, y: 2, z: 1}, //
                    {x: 5, y: 0, z: 1}, //
                    {x: 6, y: 1, z: 1},
                    {x: 4, y: 3, z: 1},
                    {x: 6, y: 5, z: 1},
                    {x: 5, y: 6, z: 1},
                    {x: 3, y: 4, z: 1},
                    {x: 1, y: 6, z: 1},
                    {x: 0, y: 5, z: 1},
                    {x: 2, y: 3, z: 1},
                    {x: 0, y: 1, z: 1}
                ],
                layer: 5
                // width: 10,
                // height: 10
            },
            // Smaller check mark
            // -4, -16
            {
                id: "checkmark",
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x008000, fill: true, },
                points: [
                    {x: 9, y: 3, z: 1},
                    {x: 10, y: 4, z: 1},
                    {x: 14, y: 0, z: 1},
                    {x: 15, y: 1, z: 1},
                    {x: 10, y: 6, z: 1},
                    {x: 8, y: 4, z: 1}
                ],
                layer: 5
                // width: 10,
                // height: 10
            },

            // Warning triangle
            // -4, -16
            {
                id: "triangle",
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x805000, fill: true, },
                points: [
                    {x: 22, y: 0, z: 1},
                    {x: 26, y: 6, z: 1},
                    {x: 18, y: 6, z: 1}
                ],
                layer: 5
                // width: 10,
                // height: 10
            },
            // Exclamation mark for warning triangle
            // -4, -16
            {
                id: "exclamation",
                drawMode: DrawMode.PIXEL,
                drawModeOptions: {color: 0x000000},
                points: [
                    {x: 22, y: 2, z: 1},
                    {x: 22, y: 3, z: 1},
                    {x: 22, y: 5, z: 1}
                ],
                layer: 5
                // width: 10,
                // height: 10
            }




            //  {
            //     drawMode: DrawMode.TEXT,
            //     drawModeOptions: {color: Math.random() * 16777216, fill: true, font: "4x6", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf"},
            //     points: {x: 30, y:16, z: 1},
            //     text: "Hello!",
            //     layer: 4
            //     // width: 10,
            //     // height: 10
            // }, 
            // {
            //     drawMode: DrawMode.TEXT,
            //     drawModeOptions: {
            //         color: 0x008000, 
            //         fill: false, 
            //         font: "4x6", 
            //         "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf"
            //         // effects: [new Effect(EffectType.SCROLLLEFT, {rate: 1})]
            //     },
            //     points: {x: 64, y: 24, z: 1},
            //     text: "Hello world!",
            //     layer: 6
            // }
            // Raspberry Pi temperature readout.
            // ,
            // {
            //     drawMode: DrawMode.TEXT,
            //     drawModeOptions: {color: 0x800000, fill: false, font: "4x6", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf"},
            //     points: {x: 25, y: 8, z: 1},
            //     text: this.temp,
            //     layer: 7
            // }
            // {
            //     drawMode: DrawMode.BUFFER,
            //     drawModeOptions: {},
            //     points: {x: 1, y: 1, z: 1},
            //     // imagePath: "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/docs/demo-thumbnail.png"
            //     buffer: Buffer.from("ff0000", "hex"),
            //     height: 1,
            //     width: 1
            // }
        ]);

        this.getCanvas().getCanvasSection("bottomlayer")?.setRepresentation([
            {
                id: "rectangle",
                drawMode: DrawMode.RECTANGLE,
                drawModeOptions: {color: 0x000080, fill: true},
                points: {x: 0, y: 0, z: 1},
                width: 32,
                height: 32,
                layer: 5
            }
        ]);

        this.getCanvas().getCanvasSection("image")?.setRepresentation([
            {
                id: "wesley",
                drawMode: DrawMode.IMAGE,
                drawModeOptions: {color: 0x000000, fill: false},
                imagePath: "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/17529334_transparent.png",
                points: {x: 0, y: 0, z: 0},
                width: 32,
                height: 32,
                layer: 7
                
            }
        ]);

        this.getCanvas().getCanvasSection("scrollTest")?.setRepresentation([
            {
                id: "scrolltest",
                drawMode: DrawMode.TEXT,
                drawModeOptions: {
                    color: 0xFFFFFF, 
                    fill: false, 
                    font: "4x6", 
                    "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf",
                    effects: [new Effect(EffectType.SCROLLDOWN, {rate: 200})]
                },
                points: {x: 0, y: 0, z: 1},
                text: timeString,
                layer: 6
            }
        ]);



        this.paint();
        setTimeout(() => {this.randomColors();}, 5);
    }

}
