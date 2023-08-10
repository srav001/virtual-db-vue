import type { UtilityFunction } from '../functions/utilities/common';

export type ActionsNames<T extends string> = T;
export type Actions<T = string> = Record<ActionsNames<T>, UtilityFunction>;

type WorkerEventProps<T> = {
  reply?: boolean;
} & T;
export interface WorkerEvent<T = unknown> extends MessageEvent {
  data: {
    action: keyof Actions;
    props: WorkerEventProps<T>;
  };
}
