import { expect, test } from '@playwright/test';

test('loads the iPhone-first home screen without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('buybye')).toBeVisible();
  await expect(page.getByText('Available to spend')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
});

test('navigates between primary tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Worth it?' }).click();
  await expect(page.getByRole('heading', { name: 'Worth it?' })).toBeVisible();
  await page.getByRole('button', { name: 'Goals' }).click();
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
});

test('exposes a PWA manifest and keeps app data available offline', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText(/offline/i)).toBeVisible();
  await expect(page.getByText('Available to spend')).toBeVisible();
});
