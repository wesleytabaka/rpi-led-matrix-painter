import { Canvas } from "./canvas";
import { CanvasSection } from "./canvassection";
import { DrawMode } from "./drawmode";
import { DrawModeOption } from "./drawmodeoption";
import { Effect } from "./effect";
import { EffectOptions } from "./effectoptions";
import { EffectType } from "./effecttype";
import { Painter } from "./painter";
import { PaintingInstruction } from "./paintinginstruction";
import { Point } from "./point";
import * as matrix from "../rpi-led-matrix"

const pixelMapperConfig = matrix.LedMatrixUtils.encodeMappers({"type": matrix.PixelMapperType.U}, {"type": matrix.PixelMapperType.Rotate, "angle": 180});
 const painter = new Painter(
     {
         ...matrix.LedMatrix.defaultMatrixOptions(),
         rows: 32,
         cols: 64,
	    chainLength: 2,
        pixelMapperConfig: pixelMapperConfig
        
     },
     {
         ...matrix.LedMatrix.defaultRuntimeOptions(),
         gpioSlowdown: 2
     }
 );

let matrix_export = matrix.LedMatrix

 painter.test();

export { Canvas, CanvasSection, DrawMode, DrawModeOption, Effect, EffectOptions, EffectType, Painter, PaintingInstruction, Point, matrix_export as Matrix };
