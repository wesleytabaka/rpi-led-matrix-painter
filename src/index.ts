import { Canvas } from "./canvas";
import { Painter } from "./painter";
import * as matrix from "../rpi-led-matrix"

const painter = new Painter(
    {
        ...matrix.LedMatrix.defaultMatrixOptions(),
        rows: 32,
        cols: 64,
        chainLength: 1
    },
    {
        ...matrix.LedMatrix.defaultRuntimeOptions()
    }
);

painter.test();

export { Canvas, Painter };