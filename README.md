# StepTracker

[Open StepTracker](https://2319bli.github.io/step-tracker/)

GitHub Pages serves the dashboard. It reads daily totals from Cloudflare D1 through the StepTracker Worker. Approved browsers can add, correct and remove daily totals. The tracker checks the previous value on each save to prevent one device silently overwriting another device's edit.

## Connect a device

Choose **Log steps** on the new browser. Open its approval link on a browser already connected to StepTracker and select **Approve browser**. Return to the new browser and choose **Check connection**. The link contains a public device fingerprint. The private device token stays in that browser and is sent only to the StepTracker Worker when authorising an operation.

For the first browser, or if all connected browsers have been lost, expand **Set up or recover the first browser** and run the displayed command in the private Cloudflare D1 console for `step-tracker`. To revoke a device, remove its fingerprint from `step_devices`.

## Storage and backups

The bundled history in `data/steps.json` covers 1 October 2024 through 21 November 2026 and serves as a fallback if the live database is temporarily unavailable. The dashboard also caches its last successful read. Cloud writes require a connection. Earlier browser-only edits can be reviewed individually in **Daily log**.

**Download updated tracker**, **Export CSV** and **Site data (JSON)** export the displayed history. Downloaded HTML copies work offline and keep their own browser-local edits.

## Deployment

Pages publishes the root of `main` without a build step. The Worker source, D1 schema and deployment configuration are in `cloudflare/`. After editing the Worker, deploy it separately with `npx wrangler deploy --config cloudflare/wrangler.jsonc` from an authorised Cloudflare account.
