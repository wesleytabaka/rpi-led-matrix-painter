import { EffectOptions } from "./effectoptions";
import { EffectType } from "./effecttype";

export interface Effect {
    effectType: EffectType
    effectOptions: EffectOptions;
}