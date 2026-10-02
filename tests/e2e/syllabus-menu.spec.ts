import { expect, test } from '@playwright/test';
import { OUTCOMES, OUTCOME_IDS, OUTCOME_SHORT_TITLES, SYLLABUS_SECTIONS } from '../../src/content/outcomes';

test('the no-hash entry is a syllabus menu with all 19 exact outcomes in syllabus-section order', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Term 4 syllabus' })).toBeVisible();
  await expect(page).toHaveTitle(/Year 7 Term 4 Syllabus/);

  const headings = await page.locator('.syllabus-group-heading h2').allTextContents();
  expect(headings).toEqual(['Properties of matter', 'Properties of water', 'Solutions', 'Separating mixtures', 'Solutions and mixtures in context']);
  const numbers = await page.locator('.syllabus-outcome-number').allTextContents();
  expect(numbers).toEqual(OUTCOME_IDS);
  await expect(page.locator('.syllabus-card')).toHaveCount(19);
  await expect(page.locator('.syllabus-activities a')).toHaveCount(20);

  for (const id of OUTCOME_IDS) {
    await expect(page.locator('.syllabus-card').filter({ has: page.locator('.syllabus-outcome-number', { hasText: id }) })).toContainText(OUTCOMES[id].wording);
    await expect(page.locator('.syllabus-card').filter({ hasText: id }).locator('h3')).toHaveText(OUTCOME_SHORT_TITLES[id]);
  }
  await expect(page.locator('.syllabus-card').filter({ hasText: '4.2.3' }).locator('.syllabus-formula')).toHaveText('ρ = mass ÷ volume');
  expect(SYLLABUS_SECTIONS.flatMap((section) => section.outcomes)).toEqual(OUTCOME_IDS);
  await expect(page.locator('.syllabus-extras')).toContainText('OPTIONAL EXTENSIONS · NOT NUMBERED SYLLABUS OUTCOMES');
  await expect(page.locator('.syllabus-extras').getByRole('link', { name: /Hydrogen plasma/ })).toHaveAttribute('href', '#/advanced/plasma');
  await expect(page.locator('.syllabus-extras').getByRole('link', { name: /Bose–Einstein condensate/ })).toHaveAttribute('href', '#/advanced/bec');
});

test('linked 4.1.1 activities open the cycle or State comparison and the brand returns to menu', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('link', { name: /4\.1\.1 Water through the Earth system: Explore the water cycle/ }).click();
  await expect(page).toHaveURL(/#\/simulators\/4\.1\.1$/);
  await expect(page.getByRole('heading', { name: 'Water cycle', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open syllabus and lesson menu' })).toBeVisible();
  await page.getByRole('link', { name: 'MatterLab syllabus menu' }).click();
  await expect(page.getByRole('heading', { name: 'Term 4 syllabus' })).toBeVisible();
  await page.getByRole('link', { name: /4\.1\.4 How states behave: Compare the three states/ }).click();
  await expect(page).toHaveURL(/#\/simulators\/4\.1\.4$/);
  await expect(page.getByRole('heading', { name: 'States of matter', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Open syllabus and lesson menu' }).click();
  await expect(page.getByRole('heading', { name: 'Term 4 syllabus' })).toBeVisible();
});

test('lesson shell provides sequential previous/next links and a direct Syllabus menu return', async ({ page }) => {
  await page.goto('/#/simulators/4.2.2');
  const sequence = page.getByRole('navigation', { name: 'Sequential syllabus navigation' });
  await expect(sequence.locator('.previous')).toContainText('4.2.1');
  await expect(sequence.locator('.next')).toContainText('4.2.3');
  await sequence.locator('.next').click();
  await expect(page).toHaveURL(/#\/simulators\/4\.2\.3$/);
  await expect(page.getByRole('heading', { name: 'Density of objects', level: 1 })).toBeVisible();
  await sequence.getByRole('link', { name: 'Syllabus menu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Term 4 syllabus' })).toBeVisible();
});

test('no-hash mobile landing fits 375 px and exposes all five syllabus section headings', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Term 4 syllabus' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const section of SYLLABUS_SECTIONS) await expect(page.locator(`[id="syllabus-heading-${section.id}"]`)).toHaveText(section.title);
});
