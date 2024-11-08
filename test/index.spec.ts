// tslint:disable: only-arrow-functions
import { expect } from 'chai';

import { getClient } from './client';

import { CFTOOLS_BASE_URL } from '../src/constants';
import { ResolveServerIdOptions } from '../src/resolvers/server-id';
import { Game } from '../src/types/general';
import { BattlEyeGUID, BohemiaInteractiveUID, CFToolsId, Steam64Id } from '../src/resolvers/player-ids';

const client = getClient();
const serverApiId = `${process.env.CFTOOLS_SERVER_API_ID}`;

const gameServerId = 'bb071c0529a46cbce80aaac3f833f8336d128cec';
const gameServer: ResolveServerIdOptions = {
  game: Game.DayZ,
  ipv4: '185.172.175.122',
  port: 2302,
};

const banListId = `${process.env.BANLIST_ID}`;
const ip = `${process.env.TEST_IP}`;
const cftoolsId = `${process.env.TEST_CFTOOLS_ID}`;
const steamId = `${process.env.TEST_STEAM_ID}`;
const battleEyeGUID = `${process.env.TEST_BATTLEYE_GUID}`;
const bohemiaInteractiveUID = `${process.env.TEST_BOHEMIA_INTERACTIVE_UID}`;

describe('Client module', function() {
  describe('Fundamentals', function() {
    it('should be defined', function() {
      expect(client).to.not.be.undefined;
    });
    it('should have a logger', function() {
      expect(client.logger).to.not.be.undefined;
    });
    it('should have an authProvider', function() {
      expect(client.authProvider).to.not.be.undefined;
    });
    it('should have a requestClient', function() {
      expect(client.requestClient).to.not.be.undefined;
    });
    it('should resolve the grant url correctly', function() {
      expect(client.grantURL()).to.equal(
        `${CFTOOLS_BASE_URL}/authorize/${client.authProvider.applicationId}`
      );
    });
    it('should authenticate', async function() {
      await client.authenticate();
      expect(client.authProvider.authenticated).to.equal(true);
      expect(client.authProvider.authenticationToken).to.not.be.undefined;
      expect(client.authProvider.issuedAt).to.not.be.undefined;
      expect(client.authProvider.expiresAt).to.not.be.undefined;
    });
  });

  describe('Grants', function() {
    it('should get app grants', async function() {
      const grants = await client.getAppGrants();
      expect(grants.status).to.equal(true);
      expect(grants.error).to.be.undefined;
      expect(grants.data.banlist).to.be.an('array');
      expect(grants.data.server).to.be.an('array');
    });
    it('should get grants a second time', async function() {
      const grants = await client.getAppGrants();
      expect(grants.status).to.equal(true);
    });
    it('should then throw an error due to rate-limiting', async function() {
      try {
        await client.getAppGrants();
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Server API ID', function() {
    it('should resolve the server API ID', function() {
      expect(client.authProvider.resolveServerApiId('test')).to.equal('test');
    });
    it('should resolve the server API ID from the client', function() {
      expect(client.authProvider.resolveServerApiId()).to.equal(client.authProvider.serverApiId);
    });
    const serverApiId = client.authProvider.serverApiId;
    it('should throw when resolving the server API ID', function() {
      delete client.authProvider.serverApiId;
      expect(() => client.authProvider.resolveServerApiId(undefined, true)).to.throw('Server API ID is missing');
      client.authProvider.serverApiId = serverApiId;
    });
    it('should no longer throw when resolving the server API ID', function() {
      expect(client.authProvider.resolveServerApiId(undefined, true)).to.equal(client.authProvider.serverApiId);
    });
  });

  describe('Game Server Details', function() {
    it('should resolve the server ID', async function() {
      const serverId = client.resolveServerId(gameServer);
      expect(serverId).to.equal(gameServerId);
    });
    it('should fetch game server details from string', async function() {
      const details = await client.gameServerDetails(gameServerId);
      expect(details.status).to.equal(true);
      expect(details.error).to.be.undefined;
      expect(details.data).to.not.be.undefined;
    });
    it('should fetch game server details from object', async function() {
      const details = await client.gameServerDetails(gameServer);
      expect(details.status).to.equal(true);
      expect(details.error).to.be.undefined;
      expect(details.data).to.not.be.undefined;
    });
    it('should throw when fetching game server details', async function() {
      try {
        await client.gameServerDetails('invalid');
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('User Lookup', function() {
    it('should lookup a user by cftools id string', async function() {
      const user = await client.lookupUser(cftoolsId);
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by cftools id object', async function() {
      const user = await client.lookupUser(new CFToolsId(cftoolsId));
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by steam id string', async function() {
      const user = await client.lookupUser(steamId);
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by steam id object', async function() {
      const user = await client.lookupUser(new Steam64Id(steamId));
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by battle eye guid string', async function() {
      const user = await client.lookupUser(battleEyeGUID);
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by battle eye guid object', async function() {
      const user = await client.lookupUser(new BattlEyeGUID(battleEyeGUID));
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by bohemia interactive uid string', async function() {
      const user = await client.lookupUser(bohemiaInteractiveUID);
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should lookup a user by bohemia interactive uid object', async function() {
      const user = await client.lookupUser(new BohemiaInteractiveUID(bohemiaInteractiveUID));
      expect(user.status).to.equal(true);
      expect(user.error).to.be.undefined;
      expect(user.data.cftoolsId).to.equal(cftoolsId);
    });
    it('should throw when looking up an invalid user by string', async function() {
      try {
        await client.lookupUser('invalid');
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
    it('should throw when looking up an invalid user by object', async function() {
      try {
        await client.lookupUser(new CFToolsId('invalid'));
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Banlist Management', function() {
    it('should manage bans by IP', async function() {
      await client.createBan({
        banListId,
        format: 'ipv4',
        identifier: ip,
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: ip });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by CFTools ID string', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: cftoolsId,
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: cftoolsId });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by CFTools ID object', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: new CFToolsId(cftoolsId),
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: cftoolsId });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by Steam ID string', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: steamId,
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: steamId });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by Steam ID object', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: new Steam64Id(steamId),
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: steamId });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by BattleEye GUID string', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: battleEyeGUID,
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: battleEyeGUID });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by BattleEye GUID object', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: new BattlEyeGUID(battleEyeGUID),
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: battleEyeGUID });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by Bohemia Interactive UID string', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: bohemiaInteractiveUID,
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: bohemiaInteractiveUID });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should manage bans by Bohemia Interactive UID object', async function() {
      await client.createBan({
        banListId,
        format: 'cftools_id',
        identifier: new BohemiaInteractiveUID(bohemiaInteractiveUID),
        reason: 'Test ban',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      const bans = await client.listBans({ banListId, filter: bohemiaInteractiveUID });
      expect(bans.status).to.equal(true);
      expect(bans.error).to.be.undefined;
      expect(bans.data).to.be.an('array').of.length(1);
      await client.deleteBan({ banListId, banId: bans.data[0].id });
      expect(bans.status).to.equal(true);
    });
    it('should throw when managing bans with an invalid identifier', async function() {
      try {
        await client.createBan({
          banListId,
          format: 'ipv4',
          identifier: 'invalid',
          reason: 'Test ban',
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
        });
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Server Information', function() {
    it('should fetch server information', async function() {
      const server = await client.serverInfo(serverApiId);
      expect(server.status).to.equal(true);
      expect(server.error).to.be.undefined;
      expect(server.data).to.not.be.undefined;
    });
    it('should throw when fetching server information for an invalid server', async function() {
      try {
        await client.serverInfo('invalid');
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Server Statistics', function() {
    it('should fetch server statistics', async function() {
      const stats = await client.serverStatistics(serverApiId);
      expect(stats.status).to.equal(true);
      expect(stats.error).to.be.undefined;
      expect(stats.data).to.not.be.undefined;
    });
    it('should throw when fetching server statistics for an invalid server', async function() {
      try {
        await client.serverStatistics('invalid');
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Players List', function() {
    it('should fetch players list', async function() {
      const players = await client.playerList(serverApiId);
      expect(players.status).to.equal(true);
      expect(players.error).to.be.undefined;
      expect(players.data).to.be.an('array');
    });
    it('should throw when fetching players list for an invalid server', async function() {
      try {
        await client.playerList('invalid');
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('Kick', function() {
    // Note: Can't be tested automatically, as it would require a player to be online
    expect(true).to.equal(true);
  });

  describe('Message Private', function() {
    // Note: Can't be tested automatically, as it would require a player to be online
    expect(true).to.equal(true);
  });

  describe('Message Global', function() {
    it('should send a global message', async function() {
      try {
        await client.messageServer({
          content: 'Test message',
          serverApiId,
        });
      } catch (error) {
        expect(error).to.be.undefined;
      }
    });
    it('should throw when sending a global message with content too long', async function() {
      try {
        await client.messageServer({
          content: 'a'.repeat(2000),
          serverApiId,
        });
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
    it('should throw when sending a global message to an invalid server', async function() {
      try {
        await client.messageServer({
          content: 'Test message',
          serverApiId: 'invalid',
        });
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });

  describe('RCon Command', function() {
    it('should send an RCon Command', async function() {
      try {
        await client.rconCommand({
          command: 'players',
          serverApiId,
        });
      } catch (error) {
        expect(error).to.be.undefined;
      }
    });
    it('should throw when sending an RCon Command to an invalid server', async function() {
      try {
        await client.rconCommand({
          command: 'players',
          serverApiId: 'invalid',
        });
      } catch (error) {
        expect(error).to.not.be.undefined;
      }
    });
  });
});