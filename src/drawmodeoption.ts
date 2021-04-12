import { Effect } from ".";

export interface DrawModeOption {
    color?: number,
    fill?: boolean,
    font?: string,
    fontPath?: string,
    effects?: [Effect]
}