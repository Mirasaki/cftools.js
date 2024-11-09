export enum Game {
  DayZ = 1,
}

export enum LeaderboardSort {
  Ascending = 1,
  Descending = -1,
}

export enum LeaderboardStat {
  Kills = 'kills',
  Deaths = 'deaths',
  Suicides = 'suicides',
  Playtime = 'playtime',
  LongestKill = 'longest_kill',
  LongestShot = 'longest_shot',
  KDRatio = 'kdratio',
}

export enum GameServerQueryError {
  /**
   * Everything ok.
   */
  NONE = 'GameServerQueryError.NONE',
  /**
   * Generic failure, like parsing or an invalid integrity check. Fallback for
   * anything else as well.
   */
  GENERIC = 'GameServerQueryError.GENERIC',
  /**
   * Any sort of timeout after the server acknowledged at least one packet.
   * Eg. a2s rules times out after info worked
   */
  TIMEOUT = 'GameServerQueryError.TIMEOUT',
  /**
   * Server is sending wrong information about its own IP address
   * (unrelated to player count spoofing)
   */
  SPOOFED = 'GameServerQueryError.SPOOFED',
  /**
   * Either A2S rules is unsupported, or the Server has not been updated
   * to any 1.* version eg. pirated servers
   */
  UNSUPORTED_VERSION = 'GameServerQueryError.UNSUPORTED_VERSION',
  /**
   * No connection can be established as server actively refuses it.
   */
  CONNECTION_FAILED = 'GameServerQueryError.CONNECTION_FAILED',
}