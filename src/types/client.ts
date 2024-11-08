import { Authentication } from '../classes/auth';
import { ClientAuthentication } from './auth';

export interface AbstractCFToolsClient {
  authProvider: Authentication;
  authenticate (): Promise<ClientAuthentication>;
}