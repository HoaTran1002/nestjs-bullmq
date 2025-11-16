export const CacheKeys = {
  // User-related cache keys
  userPermissions: (userId: string) => `user:${userId}:permissions`,

  roles: (userId: string) => `user:${userId}:roles`,

  // List cache keys
  entityList: (entity: string, params?: Record<string, unknown>) => {
    const baseKey = `list:${entity}`;
    if (!params) return baseKey;

    // Sort keys to ensure consistent order
    const sortedParams = Object.entries(params)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');

    return sortedParams ? `${baseKey}:${sortedParams}` : baseKey;
  },

  // System cache keys
  configSettings: () => 'system:config:settings',

  // Testing/debugging keys
  healthCheck: () => 'system:health:cache',

  // Token blacklisting
  tokenBlacklist: (token: string) => `token:blacklist:${token}`,
  blackListCount: () => 'token:blacklist:count',

  // Project specific keys
  projectsDropdownList: () => 'projects:dropdown_list',

  userMe: (userId: string) => `user:me:${userId}`,

  sessionHasMark: (sessionId: number) => `session:${sessionId}:hasMark`,
  sessionId: (imei: string) => `device:${imei}:sessionId`,
  userActiveSession: (userId: string) => `user:${userId}:active_session`,

  // Project excel files keys
  projectExcelFiles: (projectId: number) => `project:${projectId}:excel_files`,
} as const;

// Cache TTLs (In milliseconds)
export const USER_ME_CACHE_TTL = 360000;
export const PROJECTS_DROPDOWN_LIST_CACHE_TTL = 360000;
export const MEASUREMENT_SESSION_CACHE_TTL = 28800000; // 8 hours
export const USER_ACTIVE_SESSION_CACHE_TTL = 360000;
