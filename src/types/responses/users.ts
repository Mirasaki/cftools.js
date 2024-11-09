import type { BaseResponse, ClientBaseResponse } from './base';

export type LookupUserResponse = BaseResponse & {
  cftools_id: string;
};

export type ClientLookupUserResponse = ClientBaseResponse<{
  cftoolsId: string;
}>;