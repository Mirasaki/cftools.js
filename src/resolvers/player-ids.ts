export abstract class AbstractPlayerId {
  public id: string;
  constructor(id: string) {
    this.id = id;
  }
  public abstract getRawId(): string;
}

export class Steam64Id extends AbstractPlayerId {
  public getRawId(): string {
    return this.id;
  }
}

export class BattlEyeGUID extends AbstractPlayerId {
  public getRawId(): string {
    return this.id;
  }
}

export class BohemiaInteractiveUID extends AbstractPlayerId {
  public getRawId(): string {
    return this.id;
  }
}

export class CFToolsId extends AbstractPlayerId {
  public getRawId(): string {
    return this.id;
  }
}

export type AnyPlayerId = Steam64Id | BattlEyeGUID | BohemiaInteractiveUID | CFToolsId;
export type PlayerIdType = 'steam64' | 'cftoolsid' | 'battleyeguid' | 'bohemiainteractiveuid';

export const idISteam64Id = (id: AnyPlayerId): id is Steam64Id => id instanceof Steam64Id;
export const idICFToolsId = (id: AnyPlayerId): id is CFToolsId => id instanceof CFToolsId;
export const idIBattlEyeGUID = (id: AnyPlayerId): id is BattlEyeGUID => id instanceof BattlEyeGUID;
export const idIBohemiaInteractiveUID = (id: AnyPlayerId): id is BohemiaInteractiveUID =>
  id instanceof BohemiaInteractiveUID;

export const isSteam64 = (id: string) => id.match(/^765[0-9]{14}$/) !== null;
export const isCFToolsId = (id: string) => id.match(/^[0-9a-f]{24}$/) !== null;
export const isBattlEyeGUID = (id: string) => id.match(/^[0-9a-f]{32}$/) !== null;
export const isBohemiaInteractiveUID = (id: string) => id.match(/^[0-9a-zA-Z-_]{43}=$/) !== null;

export const getPlayerIdType = (id: string): PlayerIdType | null => {
  if (isSteam64(id)) {
    return 'steam64';
  } else if (isCFToolsId(id)) {
    return 'cftoolsid';
  } else if (isBattlEyeGUID(id)) {
    return 'battleyeguid';
  } else if (isBohemiaInteractiveUID(id)) {
    return 'bohemiainteractiveuid';
  } 

  return null;
};