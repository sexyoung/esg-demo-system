import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the 4 demo paths from the saved design doc:
 *   1. Plant Manager Acme dashboard opens correctly
 *   2. Switch to ESG Manager → Map → marker → side panel update
 *   3. Switch to Site Operator → real-time grid → drawer open
 *   4. Switch to Admin → Config Inspector live preview
 *
 * Tests assert that key sections render. They do not assert exact
 * data values, since metrics fluctuate every tick.
 */

const ACME_DASHBOARD = '/tenants/acme';

async function switchRole(page: import('@playwright/test').Page, fromShortName: string, toFullName: RegExp) {
  // Role pill accessible name is "Role <shortName>", e.g. "Role Plant Manager".
  await page.getByRole('button', { name: new RegExp(`Role\\s+${fromShortName}`, 'i') }).click();
  // Dropdown items expose the full role name like "ESG Manager / 永續長".
  await page.getByRole('button', { name: toFullName }).click();
}

test.describe('Demo arc — 4 paths', () => {
  test('Path 1: Plant Manager Acme dashboard renders', async ({ page }) => {
    await page.goto(ACME_DASHBOARD);

    // Default role is Site Operator (floor view); switch to Plant Manager.
    await expect(page.getByRole('button', { name: /Tenant\s+Acme/ })).toBeVisible();
    await switchRole(page, 'Site Operator', /Facility \/ Plant Manager/);
    await expect(page.getByRole('button', { name: /Role\s+Plant Manager/i })).toBeVisible();

    // Plant Manager hero is Live Power Tick (CSS uppercase, DOM is title-case).
    await expect(page.getByText(/Live Power Tick/i).first()).toBeVisible();

    // KPI strip with the 4 main metrics.
    await expect(page.getByText('今日總用電')).toBeVisible();
    await expect(page.getByText('碳排放')).toBeVisible();
    await expect(page.getByText('電費')).toBeVisible();

    // Library showcase widgets present.
    await expect(page.getByText(/24h 能流圖/i)).toBeVisible();
    await expect(page.getByText(/Recommendation Engine/i)).toBeVisible();
    await expect(page.getByText(/24h 能源組合/i)).toBeVisible();
  });

  test('Path 2: ESG Manager → Map → side panel ready', async ({ page }) => {
    await page.goto(ACME_DASHBOARD);

    await switchRole(page, 'Site Operator', /ESG Manager.*永續長/);

    // ESG Manager hero is Target vs Actual.
    await expect(page.getByText(/Target vs Actual/i)).toBeVisible();

    // Sidebar exposes Map module for ESG Manager only.
    const mapLink = page.getByRole('link', { name: /全域地圖/ });
    await expect(mapLink).toBeVisible();
    await mapLink.click();

    await expect(page).toHaveURL(/\/map/);
    // Basemap loads (MapLibre attaches `.maplibregl-map` to the container).
    await expect(page.locator('.maplibregl-map')).toBeVisible();

    // Side panel is part of the ESG portfolio map page; it shows even before
    // a marker click (with a "click a site" placeholder or the default site).
    // Asserting the panel container is enough for smoke coverage.
    await expect(page.locator('aside, [data-testid="map-side-panel"]').first()).toBeVisible();
  });

  test('Path 3: Site Operator real-time grid + drawer opens', async ({ page }) => {
    await page.goto(ACME_DASHBOARD);

    // Default role is already Site Operator — no switch needed.
    await expect(page.getByRole('button', { name: /Role\s+Site Operator/i })).toBeVisible();

    // Compact Site Operator layout (CSS uppercase; DOM is title-case).
    // .first() because the layout config registers live-tick + recent-events
    // twice for orientation responsiveness (one hidden via media query).
    await expect(page.getByText(/Live Power Tick/i).first()).toBeVisible();
    await expect(page.getByText('事件流').first()).toBeVisible();
    await expect(page.getByText(/產線即時監控/)).toBeVisible();
    await expect(page.getByText(/Equipment Pulse/i)).toBeVisible();

    // Operator actions bar — clicking 告警 should slide up the drawer.
    const alertsButton = page.getByRole('button', { name: /告警.*Active Alerts/s });
    await expect(alertsButton).toBeVisible();
    await alertsButton.click();

    const drawer = page.getByRole('dialog', { name: /告警/ });
    await expect(drawer).toBeVisible();

    // Drawer hosts the existing AlertsPanel (its section header "告警 · N 條").
    await expect(drawer.getByText(/告警\s*·\s*\d+\s*條/)).toBeVisible();

    // Esc closes it.
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('Path 4: Admin Config Inspector renders with live preview', async ({ page }) => {
    await page.goto(ACME_DASHBOARD);

    await switchRole(page, 'Site Operator', /Admin.*顧問/);

    // Inspector heading + at least one widget id from the registry.
    // (Multiple matches exist: section header, table cell, doc breadcrumb —
    // .first() picks the section header.)
    await expect(page.getByText(/Config Inspector/i).first()).toBeVisible();
    await expect(page.getByText('live-tick').first()).toBeVisible();
  });
});
