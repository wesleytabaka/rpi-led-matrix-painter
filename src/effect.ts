import { EffectOptions } from "./effectoptions";
import { EffectType } from "./effecttype";

export class Effect {
    effectType: EffectType
    effectOptions: EffectOptions;

    constructor(effectType: EffectType, effectOptions: EffectOptions){
        this.effectType = effectType;
        this.effectOptions = effectOptions;
    }

}