import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  createPaginator,
  paginate,
  pagination,
} from 'prisma-extension-pagination';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    super({
      datasources: {
        db: {
          url: configService.databaseUrl, // Explicitly pass if needed, usually env() works
        },
      },
    });

    this.logger.setContext(PrismaService.name);
    // Log the URL being used with debug level for sensitive information
    this.logger.debug(
      `[PrismaService] Initializing with DATABASE_URL: ${configService.databaseUrl}`,
    );

    // Note: $use middleware has been replaced with Client Extensions
    // Use withSoftDelete() or extended() methods to get enhanced client
  }

  /**
   * Create extended Prisma client with soft delete functionality
   * Replaces the deprecated $use middleware with Client Extensions
   */
  withSoftDelete() {
    return this.$extends({
      name: 'soft-delete-extension',
      query: {
        $allModels: {
          async findMany({ args, query }) {
            // Apply soft delete filter to all findMany operations
            if (!args) args = {};
            if (!args.where) args.where = {};

            // Only add deletedAt filter if the model has this field and it hasn't been specified
            if (
              'deletedAt' in args.where &&
              (args.where as any).deletedAt === undefined
            ) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },
          async findFirst({ args, query }) {
            if (!args) args = {};
            if (!args.where) args.where = {};

            // Only add deletedAt filter if the model has this field and it hasn't been specified
            if (
              'deletedAt' in args.where &&
              (args.where as any).deletedAt === undefined
            ) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },
        },
      },
    });
  }

  /**
   * Get Prisma client with pagination extension for all models
   * Uses the pagination() function to enable pagination on all models
   */
  withPagination() {
    return this.$extends(
      pagination({
        pages: {
          limit: 20, // Default limit for page-based pagination
          includePageCount: true, // Include page count by default
        },
        cursor: {
          limit: 20, // Default limit for cursor-based pagination
        },
      }),
    );
  }

  /**
   * Get Prisma client with custom pagination for specific models
   * Uses createPaginator for more granular control
   */
  withCustomPagination() {
    const customPaginate = createPaginator({
      pages: {
        limit: 10,
        includePageCount: true,
      },
      cursor: {
        limit: 10,
      },
    });

    return this.$extends({
      model: {
        $allModels: {
          paginate: customPaginate,
        },
      },
    });
  }

  /**
   * Legacy method for backward compatibility
   * Get Prisma client with basic pagination extension
   */
  pg() {
    return this.$extends({
      model: {
        $allModels: {
          paginate,
        },
      },
    });
  }

  /**
   * Get fully extended Prisma client with both soft delete and pagination
   * Combines soft delete functionality with comprehensive pagination
   */
  extended() {
    return this.$extends({
      name: 'combined-extensions',
      model: {
        $allModels: {
          paginate,
        },
      },
      query: {
        $allModels: {
          async findMany({ args, query }) {
            if (!args) args = {};
            if (!args.where) args.where = {};

            // Only add deletedAt filter if the model has this field and it hasn't been specified
            if (
              'deletedAt' in args.where &&
              (args.where as any).deletedAt === undefined
            ) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },
          async findFirst({ args, query }) {
            if (!args) args = {};
            if (!args.where) args.where = {};

            // Only add deletedAt filter if the model has this field and it hasn't been specified
            if (
              'deletedAt' in args.where &&
              (args.where as any).deletedAt === undefined
            ) {
              (args.where as any).deletedAt = null;
            }

            return query(args);
          },
        },
      },
    }).$extends(
      pagination({
        pages: {
          limit: 20,
          includePageCount: true,
        },
        cursor: {
          limit: 20,
        },
      }),
    );
  }

  /**
   * Geo extension: PostGIS helpers cho Prisma
   */
  withGeo() {
    return this.$extends({
      name: 'postgis-extension',
      model: {
        organization: {
          async findNearbyWithFilters(
            lat: number,
            lng: number,
            zoom: number,
            {
              search,
              category,
              organizationType,
              prisma,
              radius,
              limit,
              declutter,
              cursor,
              slot,
              hasPromotions,
            }: {
              search?: string;
              category?: string;
              organizationType?: string;
              prisma: PrismaService;
              radius?: number;
              limit?: number;
              declutter?: boolean;
              cursor?: string;
              slot?: string;
              hasPromotions?: boolean;
            },
          ) {
            // Constants for radius calculation
            const RADIUS_BASE_METERS = 20_000_000;
            const MIN_RADIUS_METERS = 500;
            const MIN_ZOOM = 1;
            const MAX_ZOOM = 20;
            const DEFAULT_ZOOM = 12;

            const latValue = Number.isFinite(Number(lat)) ? Number(lat) : 0;
            const lngValue = Number.isFinite(Number(lng)) ? Number(lng) : 0;
            const zoomLevel = Number.isFinite(Number(zoom))
              ? Number(zoom)
              : DEFAULT_ZOOM;
            const clampedZoom = Math.max(
              MIN_ZOOM,
              Math.min(zoomLevel, MAX_ZOOM),
            );
            const overrideRadius =
              typeof radius === 'number' && Number.isFinite(radius)
                ? Math.abs(radius)
                : undefined;
            const computedRadius = RADIUS_BASE_METERS / 2 ** clampedZoom;

            // Dynamic max radius based on zoom level to prevent over-fetching at low zoom
            const getMaxRadius = (zoom: number): number => {
              if (zoom <= 6) return 5_000; // 5km at city level
              if (zoom <= 8) return 8_000; // 8km at district level
              if (zoom <= 10) return 12_000; // 12km
              if (zoom <= 12) return 20_000; // 20km
              return 20_000;
            };

            const MAX_RADIUS_METERS = getMaxRadius(clampedZoom);

            const radiusMeters = Math.max(
              MIN_RADIUS_METERS,
              Math.min(overrideRadius ?? computedRadius, MAX_RADIUS_METERS),
            );
            const normalizedRadius = Math.round(radiusMeters);

            // Build WHERE clauses
            const whereClauses: string[] = [
              `ST_DWithin(
                o.location,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3
              )`,
            ];
            const params: any[] = [lngValue, latValue, normalizedRadius];

            if (organizationType) {
              params.push(organizationType);
              whereClauses.push(`o."organizationType" = $${params.length}`);
            }

            if (slot) {
              params.push(slot);
              whereClauses.push(`o."slot" = $${params.length}::"Slot"`);
            }

            const activePromotionExistsClause = `
              EXISTS (
                SELECT 1
                FROM "_OrganizationToPromotion" op_filter
                JOIN "promotions" p_filter ON p_filter.id = op_filter."B"
                WHERE op_filter."A" = o.id
                  AND p_filter."isActive" = true
                  AND p_filter."startDate" <= NOW()
                  AND (
                    p_filter."endDate" IS NULL
                    OR p_filter."endDate" >= NOW()
                    OR p_filter."endDate" < p_filter."startDate"
                  )
              )
            `;

            if (typeof hasPromotions === 'boolean') {
              whereClauses.push(
                hasPromotions
                  ? activePromotionExistsClause
                  : `NOT ${activePromotionExistsClause}`,
              );
            }

            if (search) {
              const searchPattern = `%${search.toLowerCase()}%`;
              params.push(searchPattern);
              const namePlaceholder = `$${params.length}`;
              params.push(searchPattern);
              const categoryTitlePlaceholder = `$${params.length}`;
              params.push(searchPattern);
              const categorySlugPlaceholder = `$${params.length}`;

              whereClauses.push(
                `(
                  LOWER(o.name) LIKE ${namePlaceholder}
                  OR EXISTS (
                    SELECT 1
                    FROM "_CategoryToOrganization" search_co
                    JOIN "Category" search_c ON search_c.id = search_co."A"
                    WHERE search_co."B" = o.id
                      AND (
                        LOWER(search_c.title) LIKE ${categoryTitlePlaceholder}
                        OR LOWER(search_c.slug) LIKE ${categorySlugPlaceholder}
                      )
                  )
                )`,
              );
            }

            // Category filter needs to be in HAVING clause since it's aggregated
            let havingClause = '';
            if (category) {
              params.push(category.toLowerCase());
              havingClause = ` HAVING BOOL_OR(LOWER(c.slug) = $${params.length}) `;
            }

            // Constants for limit calculation - simplified, frontend controls limit
            const DEFAULT_LIMIT = 10;
            const MIN_LIMIT = 1;
            const MAX_LIMIT = 200; // Global maximum
            const parsedLimit =
              typeof limit === 'number' && Number.isFinite(limit)
                ? Math.round(Math.abs(limit))
                : DEFAULT_LIMIT;
            const normalizedLimit = Math.max(
              MIN_LIMIT,
              Math.min(parsedLimit, MAX_LIMIT),
            );

            // Add one extra to determine if there are more results for cursor pagination
            const limitPlusOne = normalizedLimit + 1;
            params.push(limitPlusOne);
            const limitPlaceholder = `$${params.length}`;

            // Zoom-based minimum distance for decluttering
            // Higher zoom = show more nearby markers, Lower zoom = only show distant markers
            const getMinDistanceMeters = (zoom: number): number => {
              if (zoom >= 16) return 0; // Street level: show everything
              if (zoom >= 14) return 50; // Neighborhood: 50m minimum
              if (zoom >= 12) return 200; // District: 200m minimum
              if (zoom >= 10) return 500; // City: 500m minimum
              if (zoom >= 8) return 1000; // Region: 1km minimum
              return 2000; // Country: 2km minimum
            };
            const shouldDeclutter = declutter !== false;
            const minDistance = shouldDeclutter
              ? getMinDistanceMeters(clampedZoom)
              : 0;

            // Parse cursor for pagination (format: "distance:id")
            let cursorDistance: number | null = null;
            let cursorId: string | null = null;
            if (cursor) {
              const parts = cursor.split(':');
              if (parts.length === 2 && parts[0] && parts[1]) {
                cursorDistance = parseFloat(parts[0]);
                cursorId = parts[1];
              }
            }

            // Add cursor pagination to WHERE clauses
            if (cursorDistance !== null && cursorId) {
              params.push(cursorDistance);
              const cursorDistancePlaceholder = `$${params.length}`;
              params.push(cursorId);
              const cursorIdPlaceholder = `$${params.length}`;
              whereClauses.push(
                `(ST_Distance(o.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography), o.id) > (${cursorDistancePlaceholder}, ${cursorIdPlaceholder})`,
              );
            }

            // Simplified query with 2 CTEs instead of 3
            // Removed coordinate deduplication to allow multiple stores at same location
            const query = `
              WITH nearby_stores AS (
                SELECT
                  o.id,
                  o.name,
                  o.slug,
                  o.latitude,
                  o.longitude,
                  o."organizationType",
                  o.address,
                  o."contactPhone",
                  o."contactEmail",
                  o.website,
                  o.description,
                  o.status,
                  o."publishedAt",
                  o.slot,
                  (
                    SELECT COALESCE(
                      BOOL_OR(
                        p_check."isActive" = true
                        AND p_check."startDate" <= NOW()
                        AND (
                          p_check."endDate" IS NULL
                          OR p_check."endDate" >= NOW()
                          OR p_check."endDate" < p_check."startDate"
                        )
                      ),
                      false
                    )
                    FROM "_OrganizationToPromotion" op
                    JOIN "promotions" p_check ON p_check.id = op."B"
                    WHERE op."A" = o.id
                  ) AS "hasPromotions",
                  ST_Distance(
                    o.location,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                  ) as distance
                FROM "organization" o
                WHERE ${whereClauses.join(' AND ')}
                  ${minDistance > 0 ? `AND ST_Distance(o.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) >= ${minDistance}` : ''}
              ),
              stores_with_categories AS (
                SELECT
                  s.id,
                  s.name,
                  s.slug,
                  s.latitude,
                  s.longitude,
                  s."organizationType",
                  s.address,
                  s."contactPhone",
                  s."contactEmail",
                  s.website,
                  s.description,
                  s.status,
                  s."publishedAt",
                  s.slot,
                  s."hasPromotions",
                  s.distance,
                  COALESCE(
                    JSON_AGG(
                      JSON_BUILD_OBJECT(
                        'id', c.id,
                        'title', c.title,
                        'slug', c.slug
                      )
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'::json
                  ) as categories
                FROM nearby_stores s
                LEFT JOIN "_CategoryToOrganization" co ON co."B" = s.id
                LEFT JOIN "Category" c ON c.id = co."A"
                GROUP BY s.id, s.name, s.slug, s.latitude, s.longitude, s."organizationType",
                         s.address, s."contactPhone", s."contactEmail", s.website,
                         s.description, s.status, s."publishedAt", s.slot, s."hasPromotions", s.distance
                ${havingClause}
              )
              SELECT
                s.id,
                s.name,
                s.slug,
                s.latitude,
                s.longitude,
                s."organizationType",
                s.address,
                s."contactPhone",
                s."contactEmail",
                s.website,
                s.description,
                s.status,
                s."publishedAt",
                s.slot,
                s."hasPromotions",
                (
                  SELECT JSON_BUILD_OBJECT('url', f.url)
                  FROM "File" f
                  WHERE f."logoOrganizationId" = s.id
                  LIMIT 1
                ) AS logo,
                (
                  SELECT COALESCE(
                    JSON_AGG(JSON_BUILD_OBJECT('url', f.url)),
                    '[]'::json
                  )
                  FROM "File" f
                  WHERE f."bannerOrganizationId" = s.id
                ) AS "bannerUrls",
                s.distance,
                s.categories,
                (
                  SELECT COALESCE(
                    JSON_AGG(
                      JSON_BUILD_OBJECT(
                        'id', p.id,
                        'name', p.name,
                        'code', p.code,
                        'description', p.description,
                        'discountType', p."discountType",
                        'discount', p.discount,
                        'minPrice', p."minPrice",
                        'maxDiscountPrice', p."maxDiscountPrice",
                        'thumbnail', p."thumbnail",
                        'startDate', p."startDate",
                        'endDate', p."endDate",
                        'applyToAll', p."applyToAll",
                        'isActive', p."isActive"
                      )
                      ORDER BY p."startDate" DESC
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'::json
                  )
                  FROM "_OrganizationToPromotion" op2
                  JOIN "promotions" p ON p.id = op2."B"
                  WHERE op2."A" = s.id
                    AND p."isActive" = true
                    AND p."startDate" <= NOW()
                    AND (
                      p."endDate" IS NULL
                      OR p."endDate" >= NOW()
                      OR p."endDate" < p."startDate"
                    )
                ) AS promotions,
                (
                  SELECT JSON_BUILD_OBJECT(
                    'average', ROUND(AVG(r.rating)::numeric, 1),
                    'count', COUNT(r.id)::integer
                  )
                  FROM "Review" r
                  WHERE r."organizationId" = s.id
                  HAVING COUNT(r.id) > 0
                ) AS rating
              FROM stores_with_categories s
              ORDER BY s.distance ASC, s.id ASC
              LIMIT ${limitPlaceholder}
            `;

            const rawResults = await prisma.$queryRawUnsafe<any[]>(
              query,
              ...params,
            );

            // Process results for cursor pagination
            const hasMore = rawResults.length > normalizedLimit;
            const results = hasMore
              ? rawResults.slice(0, normalizedLimit)
              : rawResults;

            // Generate next cursor if there are more results
            let nextCursor: string | null = null;
            if (hasMore && results.length > 0) {
              const lastResult = results[results.length - 1];
              nextCursor = `${lastResult.distance}:${lastResult.id}`;
            }

            // Return with pagination metadata
            return {
              locations: results,
              total: results.length,
              nextCursor,
              hasMore,
            };
          },
        },
        promotion: {
          async findNearbyWithFilters(
            lat: number,
            lng: number,
            zoom: number,
            {
              search,
              prisma,
              radius,
              limit,
              declutter,
            }: {
              search?: string;
              prisma: PrismaService;
              radius?: number;
              limit?: number;
              declutter?: boolean;
            },
          ) {
            const latValue = Number.isFinite(Number(lat)) ? Number(lat) : 0;
            const lngValue = Number.isFinite(Number(lng)) ? Number(lng) : 0;
            const zoomLevel = Number.isFinite(Number(zoom)) ? Number(zoom) : 12;
            const clampedZoom = Math.max(1, Math.min(zoomLevel, 20));
            const overrideRadius =
              typeof radius === 'number' && Number.isFinite(radius)
                ? Math.abs(radius)
                : undefined;
            const computedRadius = 20000000 / 2 ** clampedZoom;

            // Max radius theo zoom
            const getMaxRadius = (zoom: number): number => {
              if (zoom <= 6) return 5_000;
              if (zoom <= 8) return 8_000;
              if (zoom <= 10) return 12_000;
              if (zoom <= 12) return 20_000;
              return 20_000;
            };

            const MIN_RADIUS_METERS = 500;
            const MAX_RADIUS_METERS = getMaxRadius(clampedZoom);
            const radiusMeters = Math.max(
              MIN_RADIUS_METERS,
              Math.min(overrideRadius ?? computedRadius, MAX_RADIUS_METERS),
            );
            const normalizedRadius = Math.round(radiusMeters);

            const whereClauses: string[] = [
              `ST_DWithin(
        o.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )`,
              `p."isActive" = true`,
              `p."startDate" <= NOW()`,
              `p."endDate" >= NOW()`,
            ];
            const params: any[] = [lngValue, latValue, normalizedRadius];

            if (search) {
              const searchPattern = `%${search.toLowerCase()}%`;
              params.push(searchPattern);
              const namePlaceholder = `$${params.length}`;
              whereClauses.push(`LOWER(p.name) LIKE ${namePlaceholder}`);
            }

            // Limit
            const getMaxLimit = (zoom: number): number => {
              if (zoom <= 10) return 75;
              if (zoom <= 12) return 105;
              if (zoom <= 14) return 135;
              if (zoom <= 16) return 180;
              return 240;
            };
            const DEFAULT_LIMIT = 20;
            const MIN_LIMIT = 6;
            const MAX_LIMIT = getMaxLimit(clampedZoom);
            const parsedLimit =
              typeof limit === 'number' && Number.isFinite(limit)
                ? Math.round(Math.abs(limit))
                : DEFAULT_LIMIT;
            const normalizedLimit = Math.max(
              MIN_LIMIT,
              Math.min(parsedLimit, MAX_LIMIT),
            );
            params.push(normalizedLimit);
            const limitPlaceholder = `$${params.length}`;

            // Declutter
            const getMinDistanceMeters = (zoom: number): number => {
              if (zoom >= 16) return 0;
              if (zoom >= 14) return 50;
              if (zoom >= 12) return 200;
              if (zoom >= 10) return 500;
              if (zoom >= 8) return 1000;
              return 2000;
            };
            const shouldDeclutter = declutter !== false;
            const minDistance = shouldDeclutter
              ? getMinDistanceMeters(clampedZoom)
              : 0;

            // Query
            const query = `
      WITH nearby_promotions AS (
        SELECT
          p.id,
          p.name,
          p.code,
          p.description,
          p."discountType",
          p.discount,
          p."minPrice",
          p."maxDiscountPrice",
          p."startDate",
          p."endDate",
          p."thumbnail",
          p."applyToAll",
          p."isActive",
          p."createdAt",
          p."updatedAt",
          MIN(ST_Distance(
            o.location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          )) AS nearest_distance
        FROM "promotions" p
        JOIN "_OrganizationToPromotion" op ON op."B" = p.id
        JOIN "organization" o ON o.id = op."A"
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY p.id
        HAVING MIN(ST_Distance(
          o.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )) >= ${minDistance}
      )
      SELECT *
      FROM nearby_promotions
      ORDER BY nearest_distance ASC
      LIMIT ${limitPlaceholder};
    `;

            return prisma.$queryRawUnsafe<any[]>(query, ...params);
          },
        },
      },
    });
  }

  async onModuleInit() {
    // Prisma automatically queues connections, but explicit connect can catch errors early
    await this.$connect();
    this.logger.log('Prisma Client connected'); // Use log level for important state changes
  }

  async onModuleDestroy() {
    // Gracefully disconnect when the application shuts down
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected'); // Use log level for important state changes
  }

  // Optional: Add custom methods for clean shutdowns, transactions, etc. if needed
  // async enableShutdownHooks(app: INestApplication) {
  //   process.on('beforeExit', async () => {
  //     await app.close();
  //   });
  // }
}
