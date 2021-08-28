import { PaintingInstruction } from "./paintinginstruction";

export interface PaintingInstructionCache {
    [id: string]: PaintingInstruction;
}