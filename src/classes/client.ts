import { Authentication } from './auth';
import { API_VERSION, CFTOOLS_BASE_URL, UnitConstants } from '../constants';
import { ConsoleLogger } from './logger';
import { RequestClient } from './requests';

import type { ClientAuthenticationData, ClientAuthentication } from '../types/auth';
import type { AbstractCFToolsClient } from '../types/client';
import type {
  AuthenticationResponse,
  ClientGameServerResponse,
  ClientGrantsResponse,
  ClientListBansResponse,
  ClientLookupUserResponse,
  ClientPlayerListResponse,
  ClientServerInfoResponse,
  ClientServerStatisticsResponse,
  CreateBanOptions,
  DeleteBanOptions,
  GameServerResponse,
  GetSessionByCFToolsIdOptions,
  GrantsResponse,
  KickOptions,
  ListBansOptions,
  ListBansResponse,
  LookupUserResponse,
  MessagePrivateOptions,
  MessageServerOptions,
  PlayerListResponse,
  RawRConCommandOptions,
  ServerInfoResponse,
  ServerStatisticsResponse
} from '../types/responses';

import { AbstractLogger } from '../types/logger';
import { AnyPlayerId, isCFToolsId } from '../resolvers/player-ids';
import { resolveServerId, ResolveServerIdOptions } from '../resolvers/server-id';
import { isIPv4 } from 'net';

export class CFToolsClient implements AbstractCFToolsClient {
  public logger: AbstractLogger;
  public authProvider: Authentication;
  public requestClient: RequestClient;

  constructor(clientAuth: ClientAuthenticationData, logger?: AbstractLogger) {
    this.logger = logger ?? ConsoleLogger.getInstance();
    this.authProvider = new Authentication(this, clientAuth, this.logger.extend('Authentication'));
    this.requestClient = new RequestClient(this.authProvider, this.logger.extend('RequestClient'));
  }

  public grantURL(): string {
    return `${CFTOOLS_BASE_URL}/authorize/${this.authProvider.applicationId}`;
  }

  public resolveServerId(options: string | ResolveServerIdOptions): string {
    return resolveServerId(options);
  }

  public async authenticate(): Promise<ClientAuthentication> {
    if (!this.authProvider.shouldRefresh()) {
      this.logger.debug('Authentication token is still valid, returning existing token');
      return this.authProvider.currentToken();
    }

    this.logger.debug('Authentication token is expired, refreshing token');

    const response = await this.requestClient.post<AuthenticationResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/auth/register'),
      this.authProvider.getAuthenticationBody(),
      true,
    );

    const validForMs = response.valid_for * UnitConstants.MS_IN_ONE_S;
    const clientResponse: ClientAuthentication = {
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + validForMs),
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
    const response = await this.requestClient.get<GrantsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/@app/grants'),
    );

    const transformedResponse: ClientGrantsResponse = {
      status: response.status,
      error: response.error,
      data: {
        banlist: response.tokens.banlist.map((token) => ({
          createdAt: new Date(token.created_at),
          resource: {
            id: token.resource.id,
            identifier: token.resource.identifier,
            objectId: token.resource.object_id,
          }
        })),
        server: response.tokens.server.map((token) => ({
          createdAt: new Date(token.created_at),
          resource: {
            id: token.resource.id,
            identifier: token.resource.identifier,
            objectId: token.resource.object_id,
            gameserverId: token.resource.gameserver_id,
          }
        })),
      }
    };

    this.logger.debug('Successfully transformed app grants', response, transformedResponse);

    return transformedResponse;
  }

  public async gameServerDetails(options: string | ResolveServerIdOptions): Promise<ClientGameServerResponse> {
    const serverId = this.resolveServerId(options);
    const response = await this.requestClient.get<GameServerResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/gameserver/${serverId}`),
    );

    const responseData = response[serverId];
    const transformedResponse: ClientGameServerResponse = {
      status: response.status,
      error: response.error,
      data: {
        ...responseData,
        object: {
          error: responseData._object.error,
          createdAt: new Date(responseData._object.created_at),
          updatedAt: new Date(responseData._object.updated_at),
        },
        environment: {
          time: responseData.environment.time,
          timeAcceleration: responseData.environment.time_acceleration,
          perspectives: {
            '1Rd': responseData.environment.perspectives['1rd'],
            '3Rd': responseData.environment.perspectives['3rd'],
          }
        },
        host: {
          address: responseData.host.address,
          gamePort: responseData.host.game_port,
          os: responseData.host.os,
          queryPort: responseData.host.query_port,
        },
        mods: responseData.mods.map((mod) => ({
          fileId: mod.file_id,
          name: mod.name,
        })),
      }
    };

    this.logger.debug('Successfully transformed game server details', response, transformedResponse);

    return transformedResponse;
  }

  public async lookupUser(id: string | AnyPlayerId): Promise<ClientLookupUserResponse> {
    const resolvedId = typeof id === 'string' ? id : id.getRawId();

    if (isCFToolsId(resolvedId)) {
      return {
        status: true,
        error: undefined,
        data: {
          cftoolsId: resolvedId,
        }
      };
    }

    const response = await this.requestClient.get<LookupUserResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, '/users/lookup', {
        identifier: resolvedId
      }),
    );

    this.logger.debug('Successfully looked up user', response);

    return {
      status: response.status,
      error: response.error,
      data: {
        cftoolsId: response.cftools_id,
      }
    };
  }

  public async listBans({ banListId, filter = null}: ListBansOptions): Promise<ClientListBansResponse> {
    const resolvedFilterId = typeof filter === 'string' ? filter : filter?.getRawId();
    const resolvedFilter = typeof resolvedFilterId === 'string'
      ? isIPv4(resolvedFilterId)
        ? resolvedFilterId
        : (await this.lookupUser(resolvedFilterId)).data.cftoolsId
      : resolvedFilterId;

    const params = resolvedFilter ? new URLSearchParams({ filter: resolvedFilter }) : undefined;
    const response = await this.requestClient.get<ListBansResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/banlist/${banListId}/bans`, params),
    );

    const transformedResponse: ClientListBansResponse = {
      status: response.status,
      error: response.error,
      data: response.entries.map((ban) => ({
        id: ban.id,
        reason: ban.reason,
        expiresAt: ban.expires_at ? new Date(ban.expires_at) : null,
        createdAt: new Date(ban.created_at),
        updatedAt: new Date(ban.updated_at),
        status: ban.status,
        identifier: ban.identifier,
        links: ban.links,
      }))
    };

    this.logger.debug('Successfully transformed ban list', response, transformedResponse);

    return transformedResponse;
  }

  public async createBan(options: CreateBanOptions): Promise<void> {
    const resolvedIdentifier = options.format === 'ipv4'
      ? options.identifier
      : (await this.lookupUser(options.identifier)).data.cftoolsId;

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
      this.requestClient.apiUrl(API_VERSION.V1, `/banlist/${banListId}/bans/${banId}`),
    );

    this.logger.debug('Successfully deleted ban', response);
  }

  public async serverInfo(serverApiId?: string): Promise<ClientServerInfoResponse> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<ServerInfoResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/info`),
    );

    const transformedResponse: ClientServerInfoResponse = {
      status: response.status,
      error: response.error,
      data: {
        links: response.links,
        object: {
          nickname: response.server._object.nickname,
          resourceOwner: response.server._object.resource_owner,
          createdAt: new Date(response.server._object.created_at),
          updatedAt: new Date(response.server._object.updated_at),
        },
        connection: {
          peerVersion: response.server.connection.peer_version,
          prefilledCommands: response.server.connection.prefilled_commands,
          protocolUsed: response.server.connection.protcol_used,
          restricted: response.server.connection.restricted,
        },
        gameserver: {
          link: response.server.gameserver.LINK,
          game: response.server.gameserver.game,
          gameIntegration: {
            capabilities: response.server.gameserver.game_integration.capabilities,
            pollProtocol: response.server.gameserver.game_integration.poll_protocol,
            status: response.server.gameserver.game_integration.status,
            updatedAt: response.server.gameserver.game_integration.updated_at
              ? new Date(response.server.gameserver.game_integration.updated_at)
              : null,
            version: response.server.gameserver.game_integration.version,
          },
          gameserverId: response.server.gameserver.gameserver_id,
          runtime: {
            gametime: response.server.gameserver.runtime.gametime,
            restartSchedule: response.server.gameserver.runtime.restart_schedule,
            uptime: response.server.gameserver.runtime.uptime,
          },
        },
        worker: {
          clientId: response.server.worker.client_id,
          state: response.server.worker.state,
        }
      }
    };

    return transformedResponse;
  }

  public async serverStatistics(serverApiId?: string): Promise<ClientServerStatisticsResponse> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<ServerStatisticsResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/statistics`),
    );

    const transformedResponse: ClientServerStatisticsResponse = {
      status: response.status,
      error: response.error,
      data: {
        general: {
          modComplexity: response.statistics.general.mod_complexity,
          playtimeTotalSeconds: response.statistics.general.playtime_total_seconds,
          sessionsTotal: response.statistics.general.sessions_total,
        },
        aggregated: {
          playerIndividual: {
            daily: response.statistics.aggregated.player_individual.daily,
            monthly: response.statistics.aggregated.player_individual.monthly,
            weekly: response.statistics.aggregated.player_individual.weekly,
          },
          playerInflux: {
            daily: response.statistics.aggregated.player_influx.daily,
            monthly: response.statistics.aggregated.player_influx.monthly,
            weekly: response.statistics.aggregated.player_influx.weekly,
          },
          playerNewRetention: {
            daily: response.statistics.aggregated.player_new_retention.daily,
            monthly: response.statistics.aggregated.player_new_retention.monthly,
            weekly: response.statistics.aggregated.player_new_retention.weekly,
          },
          playerRetention: {
            monthly: response.statistics.aggregated.player_retention.monthly,
            weekly: response.statistics.aggregated.player_retention.weekly,
          },
          playtime: {
            daily: response.statistics.aggregated.playtime.daily,
            monthly: response.statistics.aggregated.playtime.monthly,
            weekly: response.statistics.aggregated.playtime.weekly,
          },
          sessions: {
            daily: response.statistics.aggregated.sessions.daily,
            monthly: response.statistics.aggregated.sessions.monthly,
            weekly: response.statistics.aggregated.sessions.weekly,
          },
          topCountries: response.statistics.aggregated.top_countries,
        }
      }
    };

    return transformedResponse;
  }

  public async playerList(serverApiId?: string): Promise<ClientPlayerListResponse> {
    const resolvedServerApiId = this.authProvider.resolveServerApiId(serverApiId, true);
    const response = await this.requestClient.get<PlayerListResponse>(
      this.requestClient.apiUrl(API_VERSION.V1, `/server/${resolvedServerApiId}/GSM/list`),
    );

    const transformedResponse: ClientPlayerListResponse = {
      status: response.status,
      error: response.error,
      data: response.sessions.map((session) => ({
        id: session.id,
        cftoolsId: session.cftools_id,
        connection: {
          countryCode: session.connection.country_code,
          countryNames: {
            de: session.connection.country_names.de,
            en: session.connection.country_names.en,
            es: session.connection.country_names.es,
            fr: session.connection.country_names.fr,
            ja: session.connection.country_names.ja,
            ptBR: session.connection.country_names['pt-BR'],
            ru: session.connection.country_names.ru,
            zhCN: session.connection.country_names['zh-CN'],
          },
          ipv4: session.connection.ipv4,
          malicious: session.connection.malicious,
          provider: session.connection.provider,
        },
        createdAt: new Date(session.created_at),
        gamedata: {
          playerName: session.gamedata.player_name,
          steam64: session.gamedata.steam64,
        },
        info: {
          banCount: session.info.ban_count,
          labels: session.info.labels,
          radar: session.info.radar ? {
            evaluated: session.info.radar.evaluated,
            flags: session.info.radar.flags,
            indicators: {
              ar: session.info.radar.indicators.ar,
              bcpt: session.info.radar.indicators.bcpt,
              czr: session.info.radar.indicators.czr,
              ipss: session.info.radar.indicators.ipss,
              kdr: session.info.radar.indicators.kdr,
              logdip: session.info.radar.indicators.logdip,
              lsd: session.info.radar.indicators.lsd,
              nopb: session.info.radar.indicators.nopb,
              novb: session.info.radar.indicators.novb,
              playerAge: session.info.radar.indicators.player_age,
              playtimeDays: session.info.radar.indicators.playtime_days,
              playtimePerSession: session.info.radar.indicators.playtime_per_session,
              playtimeTotal: session.info.radar.indicators.playtime_total,
              ucoun: session.info.radar.indicators.ucoun,
            },
            results: session.info.radar.results,
            score: session.info.radar.score,
          } : undefined,
        },
        live: {
          loaded: session.live.loaded,
          loadTime: session.live.load_time,
          ping: session.live.ping,
          position: session.live.position,
        },
        persona: {
          bans: {
            community: session.persona.bans.community,
            economy: session.persona.bans.economy,
            game: session.persona.bans.game,
            lastBan: session.persona.bans.last_ban,
            vac: session.persona.bans.vac,
          },
          profile: session.persona.profile,
        },
        stats: {
          deaths: session.stats.deaths,
          hits: session.stats.hits,
          kills: session.stats.kills,
          longestKill: session.stats.longest_kill,
          longestShot: session.stats.longest_shot,
          suicides: session.stats.suicides,
        }
      }))
    };

    return transformedResponse;
  }

  public async getSessionByPlayerId(options: GetSessionByCFToolsIdOptions): Promise<
    ClientPlayerListResponse['data'][0] | null
  > {
    const resolvedId = typeof options.playerId === 'string' || !isCFToolsId(options.playerId.getRawId())
      ? (await this.lookupUser(options.playerId)).data.cftoolsId
      : options.playerId.getRawId();
    const response = await this.playerList(options.serverApiId);
    const session = response.data.find((player) => player.cftoolsId === resolvedId);

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
}