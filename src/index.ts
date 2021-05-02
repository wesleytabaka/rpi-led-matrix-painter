import 'source-map-support/register';

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

const matrix_export = matrix.LedMatrix

export { Canvas, CanvasSection, DrawMode, DrawModeOption, Effect, EffectOptions, EffectType, Painter, PaintingInstruction, Point, matrix_export as Matrix };
