import { test, expect, type Page } from "@playwright/test";
const aspirin = {
  PropertyTable: {
    Properties: [
      {
        CID: 2244,
        Title: "Aspirin",
        ConnectivitySMILES: "CC(=O)OC1=CC=CC=C1C(=O)O",
        InChIKey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
      },
    ],
  },
};
async function saveAspirin(page: Page) {
  await page.route("**/api/search?**", (route) =>
    route.fulfill({ json: aspirin }),
  );
  await page.goto("/drugs");
  await page.getByLabel("Drug search").fill("aspirin");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Connected · validated response")).toBeVisible();
  await page
    .getByRole("button", { name: "Save candidate", exact: true })
    .click();
}
test("projects persist, history, backup and CSV exports", async ({ page }) => {
  await page.goto("/projects");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Open indication study");
  await page.getByLabel("Disease / indication").fill("Custom indication");
  await page.getByLabel("Biological target").fill("Custom target");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Open indication study" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open / rename" }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Renamed study");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Renamed study" }),
  ).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await csv).suggestedFilename()).toBe("projects.csv");
  await page.goto("/data");
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup JSON", exact: true }).click();
  expect((await backup).suggestedFilename()).toBe("drugforge-backup.json");
});
test("PubChem fixture, real RDKit, Ketcher edit, recalculation, comparison", async ({
  page,
}) => {
  await saveAspirin(page);
  await page.getByRole("link", { name: "Open research record" }).click();
  await page.getByRole("button", { name: "Validate & calculate" }).click();
  await expect(
    page.getByRole("heading", { name: "Latest calculated structure" }),
  ).toBeVisible();
  const masses = await page
    .getByRole("row")
    .filter({ hasText: "Molecular weight" })
    .first()
    .getByRole("cell")
    .allTextContents();
  const aspirinMass = Number(masses[1]);
  expect(aspirinMass).toBeGreaterThan(170);
  expect(aspirinMass).toBeLessThan(190);
  await expect(page.getByText("Ketcher ready", { exact: false })).toBeVisible({
    timeout: 60000,
  });
  await page.getByLabel("SMILES / structure input").fill("CCO");
  await page
    .getByRole("button", { name: "Load into editor", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByLabel("SMILES / structure input").fill("pending");
  await page.getByRole("button", { name: "Use edited structure" }).click();
  await expect(page.getByLabel("SMILES / structure input")).toHaveValue("CCO");
  await page.getByRole("button", { name: "Validate & calculate" }).click();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  const newMass = Number(
    (
      await page
        .getByRole("row")
        .filter({ hasText: "Molecular weight" })
        .first()
        .getByRole("cell")
        .allTextContents()
    )[1],
  );
  expect(newMass).toBeLessThan(aspirinMass / 2);
  await page.getByLabel("SMILES / structure input").fill("not a molecule");
  await page.getByRole("button", { name: "Validate & calculate" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/comparison");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(
    page.getByRole("img", { name: "Molecular weight comparison" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export comparison CSV" }).click();
  expect((await download).suggestedFilename()).toBe("comparison.csv");
  await page.goto("/experiments");
  await expect(page.getByText("2 calculated analyses")).toBeVisible();
});
test("peptide, antibody and vaccine records enforce capabilities", async ({
  page,
}) => {
  await page.goto("/drugs");
  for (const [name, modality] of [
    ["Peptide record", "peptide"],
    ["Antibody record", "antibody"],
    ["Vaccine record", "vaccine"],
  ]) {
    await page.getByLabel("Candidate name", { exact: true }).fill(name);
    await page.getByLabel("Modality", { exact: true }).selectOption(modality);
    if (modality !== "vaccine")
      await page.getByLabel("Sequence", { exact: true }).fill("ACDEFGHIK");
    await page.getByRole("button", { name: "Save research record" }).click();
  }
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Vaccine record" }) })
    .getByRole("link", { name: "Open research record" })
    .click();
  await expect(
    page.getByRole("button", { name: "Validate & calculate" }),
  ).toBeDisabled();
  await page.goto("/biologics");
  await page
    .getByLabel("Candidate", { exact: true })
    .selectOption({ label: "Peptide record" });
  await page.getByRole("button", { name: "Validate & save sequence" }).click();
  await expect(page.getByText("Length: 9")).toBeVisible();
});
test("API errors and cached offline fallback are distinct", async ({
  page,
}) => {
  await saveAspirin(page);
  await page.route("**/api/search?**", (route) =>
    route.fulfill({ status: 502, json: { error: "Source unavailable" } }),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Offline fallback · cached record"),
  ).toBeVisible();
  await page.getByLabel("Drug search").fill("uncached query");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Source unavailable");
});
test("mobile navigation, theme and deep links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await page.getByLabel("Color mode").selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Discovery Projects" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Discovery projects", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
