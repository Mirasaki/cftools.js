import { AnyPlayerId } from '../../resolvers/player-ids';

import type { BaseResponse, ClientBaseResponse } from './base';
import type { CamelCasedPropertiesDeep } from 'type-fest';

export type GetPriorityQueueOptions = {
  serverApiId?: string;
  playerId?: AnyPlayerId | string;
  comment?: string;
};

export type PostPriorityQueueOptions = {
  serverApiId?: string;
  playerId: AnyPlayerId | string;
  expiresAt?: Date | null;
  comment: string;
};

export type DeletePriorityQueueOptions = {
  serverApiId?: string;
  playerId: AnyPlayerId | string;
};

export type PriorityQueueEntry = {
  created_at: string;
  creator: {
    cftools_id: string;
  };
  links: {
    href: string;
    method: string;
    relationship: string;
  };
  meta: {
    comment: string;
    expiration: null | string;
    from_api: boolean;
  };
  updated_at: string;
  user: {
    cftools_id: string;
  };
  uuid: string;
};

export type PriorityQueueResponse = BaseResponse & {
  entries: PriorityQueueEntry[];
};

export type ClientPriorityQueueResponse = ClientBaseResponse<
  CamelCasedPropertiesDeep<Omit<PriorityQueueEntry, 'created_at' | 'updated_at' | 'meta'> & {
    createdAt: Date;
    updatedAt: Date;
    meta: Omit<PriorityQueueEntry['meta'], 'expiration'> & {
      expiration: Date | null;
    };
  }>[]
>;