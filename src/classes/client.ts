import { isIPv4 } from 'net';

import { Authentication } from './auth';
import { CacheManager } from './cache';
import { API_VERSION, AUTHENTICATION_TOKEN_REFRESH_INTERVAL, CFTOOLS_BASE_URL, UnitConstants } from '../constants';
import { ConsoleLogger } from './logger';
import { RequestClient } from './requests';

import type { ClientAuthenticationData, ClientAuthentication } from '../types/auth';
import type {
  AuthenticationResponse,
  BatchPostGameLabsActionOptions,
  ClientGameLabsActionsResponse,
  ClientGameLabsEntityEventsResponse,
  ClientGameLabsEntityVehiclesResponse,
  ClientGameServerResponse,
  ClientGrantsResponse,
  ClientLeaderboardResponse,
  ClientListBansResponse,
  ClientLookupUserResponse,
  ClientPlayerListResponse,
  ClientPlayerStatsResponse,
  ClientPriorityQueueResponse,
  ClientServerInfoResponse,
  ClientServerStatisticsResponse,
  ClientWhitelistResponse,
  CreateBanOptions,
  DeleteBanOptions,
  DeletePlayerStatsOptions,
  DeletePriorityQueueOptions,
  DeleteWhitelistOptions,
  GameLabsActionsResponse,
  GameLabsEntityEventsResponse,
  GameLabsEntityVehiclesResponse,
  GameServerResponse,
  GetPlayerStatsOptions,
  GetPriorityQueueOptions,
  GetSessionByCFToolsIdOptions,
  GetWhitelistOptions,
  GrantsResponse,
  KickOptions,
  LeaderboardOptions,
  LeaderboardResponse,
  ListBansOptions,
  ListBansResponse,
  LookupUserResponse,
  MessagePrivateOptions,
  MessageServerOptions,
  PlayerListResponse,
  PlayerStatsResponse,
  PostGameLabsActionOptions,
  PostPriorityQueueOptions,
  PostWhitelistOptions,
  PriorityQueueResponse,
  RawRConCommandOptions,
  ServerInfoResponse,
  ServerStatisticsResponse,
  WhitelistResponse,
} from '../types/responses';

import { AbstractLogger } from '../types/logger';
import { AnyPlayerId, isCFToolsId } from '../resolvers/player-ids';
import { resolveServerId, ResolveServerIdOptions } from '../resolvers/server-id';

import {
  transformBanListResponse,
  transformGameLabsActionsResponse,
  transformGameLabsEntityEventsResponse,
  transformGameLabsEntityVehiclesResponse,
  transformGameServerDetails, 
  transformGrantResponse,
  transformLeaderboardResponse,
  transformPlayerListResponse,
  transformPlayerStatsResponse,
  transformPriorityQueueResponse,
  transformServerInfoResponse,
  transformServerStatisticsResponse,
  transformWhitelistResponse,
} from '../resolvers/transformers';

/**
 * CacheConfigurationEntry is a tuple that represents the cache configuration
 * for a specific cache key. The first element is the time-to-live (TTL) in
 * seconds, and the second element is the maximum number of items to store.
 */
export type CacheConfigurationEntry = [number, number];

export type CacheConfiguration = {
  appGrants: CacheConfigurationEntry;
  gameServerDetails: CacheConfigurationEntry;
  userLookup: CacheConfigurationEntry;
  listBans: CacheConfigurationEntry;
  serverInfo: CacheConfigurationEntry;
  serverStatistics: CacheConfigurationEntry;
  playerList: CacheConfigurationEntry;
  gameLabsActions: CacheConfigurationEntry;
  gameLabsEntityEvents: CacheConfigurationEntry;
  gameLabsEntityVehicles: CacheConfigurationEntry;
  priorityQueue: CacheConfigurationEntry;
  whitelist: CacheConfigurationEntry;
  leaderboard: CacheConfigurationEntry;
  playerStats: CacheConfigurationEntry;
};

export const defaultCacheConfiguration: CacheConfiguration = {
  appGrants: [100, 60],
  gameServerDetails: [100, 5],
  userLookup: [100, 60],
  listBans: [100, 30],
  serverInfo: [100, 30],
  serverStatistics: [100, 30],
  playerList: [100, 30],
  gameLabsActions: [100, 60],
  gameLabsEntityEvents: [100, 60],
  gameLabsEntityVehicles: [100, 60],
  priorityQueue: [100, 30],
  whitelist: [100, 30],
  leaderboard: [100, 60],
  playerStats: [100, 60],
};

export type CachePrefix = keyof CacheConfiguration;

export const rootCacheKey = 'root';
export const cachePrefixes: CachePrefix[] = Object.keys(defaultCacheConfiguration) as CachePrefix[];

export type ClientOptions = {
  logger?: AbstractLogger;
  cacheConfiguration?: Partial<CacheConfiguration> & {
    enabled?: boolean;
  }
};

export class CFToolsClient {
  public logger: AbstractLogger;
  public authProvider: Authentication;
  public requestClient: RequestClient;
  public cacheManager: CacheManager;
  public cacheConfiguration: CacheConfiguration = defaultCacheConfiguration;
  public cachingEnabled = true;

  constructor(
    clientAuth: ClientAuthenticationData,
    options?: ClientOptions,
  ) {
    const { logger, cacheConfiguration } = options ?? {
      logger: undefined,
      cacheConfiguration: {},
    };
    this.logger = logger ?? ConsoleLogger.getInstance();
    this.authProvider = new Authentication(this, clientAuth, this.logger.extend('Authentication'));
    this.requestClient = new RequestClient(this.authProvider, this.logger.extend('RequestClient'));
    this.cacheManager = CacheManager.getInstance();
    this.cachingEnabled = cacheConfiguration?.enabled ?? true;
    delete cacheConfiguration?.enabled;
    this.cacheConfiguration = { ...defaultCacheConfiguration, ...cacheConfiguration };
  }

  private cacheTTL(prefix: CachePrefix): number {
    return this.cacheConfiguration[prefix][0] * UnitConstants.MS_IN_ONE_S;
  }

  private cacheMaxSize(prefix: CachePrefix): number {
    return this.cacheConfiguration[prefix][1];
  }

  private async cacheGet<T>(prefix: CachePrefix, key: string): Promise<T | null> {
    const resolvedKey = `${prefix}:${key}`;
    const data = this.cachingEnabled ? await this.cacheManager.get<T>(resolvedKey) : null;

    this.logger.debug('Cache get', resolvedKey, data);

    return data;
  }

  private async cacheSet<T>(prefix: CachePrefix, key: string, value: T): Promise<void> {
    if (this.cachingEnabled) {
      const resolvedKey = `${prefix}:${key}`;
      const ttl = this.cacheTTL(prefix);
      const maxSize = this.cacheMaxSize(prefix);

      await this.cacheManager.set<T>(resolvedKey, value, ttl);
      await this.cacheManager.enforceMaxSizeForPrefix(prefix, maxSize);

      this.logger.debug('Cache set', `${resolvedKey} (${ttl}ms, ${maxSize} max)`, value);
    }
  }

  public grantURL(): string {
    return `${CFTOOLS_BASE_URL}/authorize/${this.authProvider.applicationId}`;
  }

  public resolveServerId(options: string | ResolveServerIdOptions): string {
    return resolveServerId(options);
  }

  public async resolveDynamicPlayerId(
    options: { playerId: string | AnyPlayerId }
  ): Promise<string> {
    return typeof options.playerId === 'string' && isCFToolsId(options.playerId)
      ? options.playerId
      : (await this.lookupUser(options.playerId)).cftoolsId;
  }

  public async authenticate(): Promise<ClientAuthentication> {
    if (!this.authProvider.shouldRefresh()) {
      return this.authProvider.currentToken();
    }

    const response = await this.requestClient.post<AuthenticationResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/auth/register'),
      this.authProvider.getAuthenticationBody(),
      true,
    );

    const resolvedValidFor = response.valid_for
      ? response.valid_for * UnitConstants.MS_IN_ONE_S
      : AUTHENTICATION_TOKEN_REFRESH_INTERVAL;
      
    const clientResponse: ClientAuthentication = {
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + resolvedValidFor),
      token: response.token,
    };

    this.logger.debug('Successfully authenticated with CFTools API', clientResponse);

    this.authProvider.authenticated = true;
    this.authProvider.issuedAt = clientResponse.issuedAt;
    this.authProvider.expiresAt = clientResponse.expiresAt;
    this.authProvider.authenticationToken = clientResponse.token;

    return clientResponse;
  }

  public async getAppGrants(): Promise<ClientGrantsResponse> {
    const cachePrefix = 'appGrants';
    const cachedResponse = await this.cacheGet<ClientGrantsResponse>(cachePrefix, rootCacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached app grants', cachedResponse);
      return cachedResponse;
    }

    const response = await this.requestClient.get<GrantsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/@app/grants'),
    );

    const transformedResponse = transformGrantResponse(response);

    this.cacheSet(cachePrefix, rootCacheKey, transformedResponse);
    this.logger.debug('Transformed app grants', response, transformedResponse);

    return transformedResponse;
  }

  public async gameServerDetails(options: string | ResolveServerIdOptions): Promise<ClientGameServerResponse> {
    const cachePrefix = 'gameServerDetails';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientGameServerResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached game server details', cachedResponse);
      return cachedResponse;
    }

    const serverId = this.resolveServerId(options);
    const response = await this.requestClient.get<GameServerResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/gameserver/${serverId}`),
    );

    const transformedResponse = transformGameServerDetails(response, serverId);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed game server details', response, transformedResponse);

    return transformedResponse;
  }

  public async lookupUser(id: string | AnyPlayerId): Promise<ClientLookupUserResponse> {
    const cachePrefix = 'userLookup';
    const cacheKey = CacheManager.hashKeyFromObject(id);
    const cachedResponse = await this.cacheGet<ClientLookupUserResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached user lookup', cachedResponse);
      return cachedResponse;
    }

    const resolvedId = typeof id === 'string' ? id : id.getRawId();

    if (isCFToolsId(resolvedId)) {
      return {
        cftoolsId: resolvedId,
      };
    }

    const response = await this.requestClient.get<LookupUserResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/users/lookup', {
        identifier: resolvedId,
      }),
    );

    const transformedResponse: ClientLookupUserResponse = {
      cftoolsId: response.cftools_id,
    };

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Successfully looked up user', response);

    return transformedResponse;
  }

  public async listBans(options: ListBansOptions): Promise<ClientListBansResponse> {
    const cachePrefix = 'listBans';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientListBansResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached ban list', cachedResponse);
      return cachedResponse;
    }

    const { banListId, filter } = options;
    const resolvedFilterId = typeof filter === 'string' ? filter : filter?.getRawId();
    const resolvedFilter = typeof resolvedFilterId === 'string'
      ? isIPv4(resolvedFilterId)
        ? resolvedFilterId
        : (await this.lookupUser(resolvedFilterId)).cftoolsId
      : resolvedFilterId;

    const params = resolvedFilter ? new URLSearchParams({ filter: resolvedFilter }) : undefined;
    const response = await this.requestClient.get<ListBansResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/banlist/${banListId}/bans`, params),
    );

    const transformedResponse = transformBanListResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed ban list', response, transformedResponse);

    return transformedResponse;
  }

  public async createBan(options: CreateBanOptions): Promise<void> {
    const resolvedIdentifier = options.format === 'ipv4'
      ? options.identifier
      : (await this.lookupUser(options.identifier)).cftoolsId;

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/banlist/${options.banListId}/bans`),
      {
        format: options.format,
        identifier: resolvedIdentifier,
        expiresAt: options.expires === 'PERMANENT' ? 'PERMANENT' : options.expires.toISOString(),
        reason: options.reason,
      }
    );

    this.logger.debug('Successfully created ban', response);
  }

  public async deleteBan({ banListId, banId }: DeleteBanOptions): Promise<void> {
    const response = await this.requestClient.delete(
      this.requestClient.apiUrl(API_VERSION.V1, `/banlist/${banListId}/bans`, {
        ban_id: banId,
      }),
    );

    this.logger.debug('Successfully deleted ban', response);
  }

  public async serverInfo(serverApiId?: string): Promise<ClientServerInfoResponse> {
    const cachePrefix = 'serverInfo';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientServerInfoResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached server info', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<ServerInfoResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/info`),
    );

    const transformedResponse = transformServerInfoResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed server info', response, transformedResponse);

    return transformedResponse;
  }

  public async serverStatistics(serverApiId?: string): Promise<ClientServerStatisticsResponse> {
    const cachePrefix = 'serverStatistics';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientServerStatisticsResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached server statistics', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<ServerStatisticsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/statistics`),
    );

    const transformedResponse = transformServerStatisticsResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed server statistics', response, transformedResponse);

    return transformedResponse;
  }

  public async playerList(serverApiId?: string): Promise<ClientPlayerListResponse> {
    const cachePrefix = 'playerList';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientPlayerListResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached player list', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<PlayerListResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GSM/list`),
    );

    const transformedResponse = transformPlayerListResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed player list', response, transformedResponse);

    return transformedResponse;
  }

  public async getSessionByPlayerId(options: GetSessionByCFToolsIdOptions): Promise<
    ClientPlayerListResponse[0] | null
  > {
    const resolvedId = typeof options.playerId === 'string' || !isCFToolsId(options.playerId.getRawId())
      ? (await this.lookupUser(options.playerId)).cftoolsId
      : options.playerId.getRawId();
    const response = await this.playerList(options.serverApiId);
    const session = response.find((player) => player.cftoolsId === resolvedId);

    return session ?? null;
  }

  public async kickPlayer(options: KickOptions): Promise<void> {
    const resolvedSessionId = typeof options.id === 'string'
      ? options.id
      : (await this.getSessionByPlayerId({
        playerId: options.id,
        serverApiId: options.serverApiId,
      }))?.id;

    if (!resolvedSessionId) {
      throw new Error('Player session not found');
    }

    if (options.reason.length > 128) {
      throw new Error('Kick reason must be less than 128 characters');
    }

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/kick`),
      {
        gamesession_id: resolvedSessionId,
        reason: options.reason,
      }
    );

    this.logger.debug('Successfully kicked player', response);
  }

  public async messagePrivate(options: MessagePrivateOptions): Promise<void> {
    const resolvedSessionId = typeof options.id === 'string'
      ? options.id
      : (await this.getSessionByPlayerId({
        playerId: options.id,
        serverApiId: options.serverApiId,
      }))?.id;

    if (!resolvedSessionId) {
      throw new Error('Player session not found');
    }

    if (options.content.length > 256) {
      throw new Error('Private message content must be less than 256 characters');
    }

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/message-private`),
      {
        gamesession_id: resolvedSessionId,
        content: options.content,
      }
    );

    this.logger.debug('Successfully sent private message', response);
  }

  public async messageServer(options: MessageServerOptions): Promise<void> {
    if (options.content.length > 256) {
      throw new Error('Server message content must be less than 256 characters');
    }

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/message-server`),
      {
        content: options.content,
      }
    );

    this.logger.debug('Successfully sent server message', response);
  }

  public async rconCommand(options: RawRConCommandOptions): Promise<void> {
    if (options.command.length > 256) {
      throw new Error('RCon command must be less than 256 characters');
    }

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/raw`),
      {
        command: options.command,
      }
    );

    this.logger.debug('Successfully sent RCon command', response);
  }

  public async gameLabsActions(serverApiId?: string): Promise<ClientGameLabsActionsResponse> {
    const cachePrefix = 'gameLabsActions';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientGameLabsActionsResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached GameLabs actions', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<GameLabsActionsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GameLabs/actions`),
    );

    const transformedResponse = transformGameLabsActionsResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed GameLabs actions', response, transformedResponse);

    return transformedResponse;
  }

  public async gameLabsEntityEvents(serverApiId?: string): Promise<ClientGameLabsEntityEventsResponse> {
    const cachePrefix = 'gameLabsEntityEvents';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientGameLabsEntityEventsResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached GameLabs entity events', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<GameLabsEntityEventsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GameLabs/entities/events`),
    );

    const transformedResponse = transformGameLabsEntityEventsResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed GameLabs entity events', response, transformedResponse);

    return transformedResponse;
  }

  public async gameLabsEntityVehicles(serverApiId?: string): Promise<ClientGameLabsEntityVehiclesResponse> {
    const cachePrefix = 'gameLabsEntityVehicles';
    const cacheKey = CacheManager.hashKeyFromObject(serverApiId);
    const cachedResponse = await this.cacheGet<ClientGameLabsEntityVehiclesResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached GameLabs entity vehicles', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<GameLabsEntityVehiclesResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GameLabs/entities/vehicles`),
    );

    const transformedResponse = transformGameLabsEntityVehiclesResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed GameLabs entity vehicles', response, transformedResponse);

    return transformedResponse;
  }

  public async postGameLabsAction(options: PostGameLabsActionOptions): Promise<void> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(options.serverApiId, true);
    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GameLabs/action`),
      {
        actionCode: options.actionCode,
        actionContext: options.actionContext,
        parameters: options.parameters,
      }
    );

    this.logger.debug('Successfully posted GameLabs action', response);
  }

  public async batchPostGameLabsAction(options: BatchPostGameLabsActionOptions): Promise<void> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(options.serverApiId, true);

    if (options.actions.length === 0) {
      throw new Error('Batch actions must have at least one action');
    }

    if (options.actions.length > 10) {
      throw new Error('Batch actions must be less than 10');
    }

    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GameLabs/batch-actions`),
      {
        actions: options.actions,
      }
    );

    this.logger.debug('Successfully batch posted GameLabs actions', response);
  }

  public async getPriorityQueue(options: GetPriorityQueueOptions): Promise<ClientPriorityQueueResponse> {
    const cachePrefix = 'priorityQueue';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientPriorityQueueResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached priority queue', cachedResponse);
      return cachedResponse;
    }

    const resolvedOptions: Record<string, string> = {};

    if (options.playerId) {
      resolvedOptions['cftools_id'] = typeof options.playerId === 'string' && isCFToolsId(options.playerId)
        ? options.playerId
        : (await this.lookupUser(options.playerId)).cftoolsId;
    }

    if (options.comment) {
      resolvedOptions['comment'] = options.comment;
    }

    const response = await this.requestClient.get<PriorityQueueResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/queuepriority`, resolvedOptions),
    );

    const transformedResponse = transformPriorityQueueResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed priority queue', response, transformedResponse);

    return transformedResponse;
  }

  public async postPriorityQueue(options: PostPriorityQueueOptions): Promise<void> {
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/queuepriority`),
      {
        cftools_id: resolvedPlayerId,
        expiresAt: options.expiresAt ? options.expiresAt.toISOString() : null,
        comment: options.comment,
      }
    );

    this.logger.debug('Successfully posted to priority queue', response);
  }

  public async deletePriorityQueue(options: DeletePriorityQueueOptions): Promise<void> {
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.delete(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/queuepriority`, {
        cftools_id: resolvedPlayerId,
      }),
    );

    this.logger.debug('Successfully deleted from priority queue', response);
  }

  public async getWhitelist(options: GetWhitelistOptions): Promise<ClientWhitelistResponse> {
    const cachePrefix = 'whitelist';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientWhitelistResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached whitelist', cachedResponse);
      return cachedResponse;
    }

    const resolvedOptions: Record<string, string> = {};

    if (options.playerId) {
      resolvedOptions['cftools_id'] = typeof options.playerId === 'string' && isCFToolsId(options.playerId)
        ? options.playerId
        : (await this.lookupUser(options.playerId)).cftoolsId;
    }

    if (options.comment) {
      resolvedOptions['comment'] = options.comment;
    }

    const response = await this.requestClient.get<WhitelistResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/whitelist`, resolvedOptions),
    );

    const transformedResponse = transformWhitelistResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed whitelist', response, transformedResponse);

    return transformedResponse;
  }

  public async postWhitelist(options: PostWhitelistOptions): Promise<void> {
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.post(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/whitelist`),
      {
        cftools_id: resolvedPlayerId,
        expiresAt: options.expiresAt ? options.expiresAt.toISOString() : null,
        comment: options.comment,
      }
    );

    this.logger.debug('Successfully posted to whitelist', response);
  }

  public async deleteWhitelist(options: DeleteWhitelistOptions): Promise<void> {
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.delete(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${options.serverApiId}/whitelist`, {
        cftools_id: resolvedPlayerId,
      }),
    );

    this.logger.debug('Successfully deleted from whitelist', response);
  }

  public async leaderboard(options: LeaderboardOptions): Promise<ClientLeaderboardResponse> {
    const cachePrefix = 'leaderboard';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientLeaderboardResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached leaderboard', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(options.serverApiId, true);

    if (options.limit < 1 || options.limit > 100) {
      throw new Error('Leaderboard limit must be between 1 and 100');
    }

    const response = await this.requestClient.get<LeaderboardResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/leaderboard`, {
        stat: options.stat,
        order: options.order.toString(10),
        limit: options.limit.toString(10),
      }),
    );

    const transformedResponse = transformLeaderboardResponse(response);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed leaderboard', response, transformedResponse);

    return transformedResponse;
  }

  public async getPlayerStats(options: GetPlayerStatsOptions): Promise<ClientPlayerStatsResponse> {
    const cachePrefix = 'playerStats';
    const cacheKey = CacheManager.hashKeyFromObject(options);
    const cachedResponse = await this.cacheGet<ClientPlayerStatsResponse>(cachePrefix, cacheKey);

    if (cachedResponse) {
      this.logger.debug('Returning cached player statistics', cachedResponse);
      return cachedResponse;
    }

    const resolvedServerApiId = this.authProvider.resolveServerApiId(options.serverApiId, true);
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.get<PlayerStatsResponse>(
      this.requestClient.apiUrl(API_VERSION.V2, `/server/${resolvedServerApiId}/player`, {
        cftools_id: resolvedPlayerId,
      }),
    );

    const transformedResponse = transformPlayerStatsResponse(response, resolvedPlayerId);

    this.cacheSet(cachePrefix, cacheKey, transformedResponse);
    this.logger.debug('Transformed player statistics', response, transformedResponse);

    return transformedResponse;
  }

  public async resetPlayerStats(options: DeletePlayerStatsOptions): Promise<void> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(options.serverApiId, true);
    const resolvedPlayerId = await this.resolveDynamicPlayerId(options);
    
    const response = await this.requestClient.delete(
      this.requestClient.apiUrl(API_VERSION.V2, `/server/${resolvedServerApiId}/player`, {
        cftools_id: resolvedPlayerId,
      }),
    );

    this.logger.debug('Successfully deleted player statistics', response);
  }
}