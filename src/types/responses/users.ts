import type { BaseResponse } from './base';

export type LookupUserResponse = BaseResponse & {
  cftools_id: string;
};

export type ClientLookupUserResponse = BaseResponse & {
  data: {
    cftoolsId: string;
  }
}