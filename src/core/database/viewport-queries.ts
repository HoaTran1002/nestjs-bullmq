/**
 * Viewport-Based Geographic Queries
 *
 * Replaces radial search with precise viewport boundary queries
 * Ensures consistent marker sets regardless of small movements
 */

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  zoomLevel: number;
}

export interface ViewportQueryOptions {
  bounds: ViewportBounds;
  organizationType?: string;
  category?: string;
  search?: string;
  limit?: number;
  pixelDensity?: number; // For adaptive density
}

export interface ViewportQueryResult {
  locations: any[];
  total: number;
  bounds: ViewportBounds;
  density: number;
  hasMore: boolean;
}

/**
 * Convert viewport bounds to PostGIS ST_MakeEnvelope query
 * This ensures we only fetch markers within the visible viewport
 */
export function buildViewportQuery(options: ViewportQueryOptions): {
  query: string;
  params: any[];
} {
  const {
    bounds,
    organizationType,
    category,
    search,
    limit,
    pixelDensity = 1,
  } = options;

  // Build WHERE clauses for viewport boundaries
  const whereClauses: string[] = [
    `o.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)`, // Bounding box intersection
    `o.latitude IS NOT NULL`,
    `o.longitude IS NOT NULL`,
  ];

  const params: any[] = [bounds.west, bounds.south, bounds.east, bounds.north];

  // Add filters
  if (organizationType) {
    params.push(organizationType);
    whereClauses.push(`o."organizationType" = $${params.length}`);
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

  // Category filter in HAVING clause
  let havingClause = '';
  if (category) {
    params.push(category.toLowerCase());
    havingClause = ` HAVING BOOL_OR(LOWER(c.slug) = $${params.length}) `;
  }

  // Adaptive limit based on zoom and pixel density
  const adaptiveLimit = calculateAdaptiveLimit(bounds.zoomLevel, pixelDensity);
  const finalLimit = Math.min(limit || adaptiveLimit, 500); // Hard cap for performance
  params.push(finalLimit);

  const query = `
    WITH viewport_markers AS (
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
        (
          SELECT JSON_BUILD_OBJECT('url', f.url)
          FROM "File" f
          WHERE f."logoOrganizationId" = o.id
          LIMIT 1
        ) AS logo,
        -- Distance from viewport center for ranking
        ST_Distance(
          o.location,
          ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
        ) as distance,
        -- Screen-space importance score
        calculate_importance_score(o, $7) as importance_score,
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
      FROM "organization" o
      LEFT JOIN "_CategoryToOrganization" co ON co."B" = o.id
      LEFT JOIN "Category" c ON c.id = co."A"
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY o.id, o.name, o.slug, o.latitude, o.longitude, o."organizationType",
               o.address, o."contactPhone", o."contactEmail", o.website,
               o.description, o.status, o."publishedAt", o.location
      ${havingClause}
    )
    SELECT
      *,
      -- Calculate actual density for frontend
      (SELECT COUNT(*) FROM viewport_markers) as total_in_viewport
    FROM viewport_markers
    ORDER BY
      -- Prioritize by importance first, then distance
      importance_score DESC,
      distance ASC
    LIMIT $${params.length}
  `;

  return { query, params };
}

/**
 * Calculate adaptive limit based on zoom level and pixel density
 * Higher zoom = more detail, higher density = more markers
 */
function calculateAdaptiveLimit(
  zoomLevel: number,
  pixelDensity: number,
): number {
  const baseLimits: Record<number, number> = {
    1: 10, // World view
    2: 15,
    3: 20,
    4: 25,
    5: 30,
    6: 40, // Continent
    7: 50,
    8: 65, // Country
    9: 80,
    10: 100, // State/Province
    11: 120,
    12: 150, // City
    13: 180,
    14: 220, // District
    15: 260,
    16: 300, // Neighborhood
    17: 350,
    18: 400, // Street
    19: 450,
    20: 500, // Building
  };

  const clampedZoom = Math.max(1, Math.min(20, Math.round(zoomLevel)));
  const baseLimit = baseLimits[clampedZoom] || 150;

  // Adjust for pixel density (retina displays, etc.)
  return Math.round(baseLimit * Math.max(0.5, Math.min(pixelDensity, 2)));
}

/**
 * Database function for calculating marker importance
 * This helps with ranking when viewport has many markers
 */
export const importanceScoreFunction = `
  CREATE OR REPLACE FUNCTION calculate_importance_score(org "organization", zoom_level numeric)
  RETURNS numeric AS $$
  BEGIN
    -- Base score from organization type
    DECLARE base_score numeric := CASE
      WHEN org."organizationType" = 'PARTNER_COMPANY' THEN 100
      WHEN org."organizationType" = 'PARTNER_STORE' THEN 80
      ELSE 50
    END;

    -- Bonus for published status
    IF org."publishedAt" IS NOT NULL THEN
      base_score := base_score + 20;
    END IF;

    -- Bonus for complete information
    IF org.address IS NOT NULL AND org.website IS NOT NULL THEN
      base_score := base_score + 15;
    END IF;

    -- Zoom-based weighting (higher zoom = less importance bias)
    DECLARE zoom_weight numeric := LEAST(1.0, zoom_level / 15.0);
    RETURN base_score * zoom_weight;
  END;
  $$ LANGUAGE plpgsql;
`;
