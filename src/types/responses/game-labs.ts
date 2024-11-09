import type { CamelCasedPropertiesDeep } from 'type-fest';
import type { BaseResponse, ClientBaseResponse } from './base';

export type GameLabsActionParameter = {
  type: 'boolean' | 'float' | 'int' | 'string' | 'vector';
  description: string;
  displayName: string;
  options: {
    [key: string]: NonNullable<unknown>;
  };
  valueBoolean?: boolean;
  valueFloat?: number;
  valueInt?: number;
  valueString?: string;
  valueVectorX?: number;
  valueVectorY?: number;
  valueVectorZ?: number;
};

export type GameLabsAction = {
  actionCode: string;
  actionContext: string;
  actionContextFilter: string[];
  actionName: string;
  parameters: {
    [key: string]: GameLabsActionParameter;
  };
  referenceKey: string;
};

export type GameLabsActionsResponse = BaseResponse & {
  available_actions: GameLabsAction[];
};

export type ClientGameLabsActionsResponse = ClientBaseResponse<CamelCasedPropertiesDeep<GameLabsAction>[]>;

// 
// Start Entity Events
// 

export type GameLabsEntityEventsResponse = BaseResponse & {
  entities: string[];
};

export type ClientGameLabsEntityEventsResponse = ClientBaseResponse<string[]>;

// 
// Start Entity Vehicles
// 

export type GameLabsEntityVehicle = {
  className: string;
  health: number;
  id: string;
  position: [number, number];
  speed: number;
};

export type GameLabsEntityVehiclesResponse = BaseResponse & {
  entities: GameLabsEntityVehicle[];
};

export type ClientGameLabsEntityVehiclesResponse = ClientBaseResponse<
  CamelCasedPropertiesDeep<GameLabsEntityVehicle>[]
>;

// 
// Start Post Action
// 

export type PostGameLabsActionOptions = {
  serverApiId?: string;
  actionCode: string;
  actionContext: 'world' | 'player' | 'vehicle' | 'object';
  referenceKey: string | null;
  parameters: {
    [key: string]: {
      [key: string]: string | number | boolean;
    };
  };
};

export type BatchPostGameLabsActionOptions = {
  serverApiId?: string;
  actions: Omit<PostGameLabsActionOptions, 'serverApiId'>[];
};