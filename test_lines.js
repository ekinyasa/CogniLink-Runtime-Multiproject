import { renderHub } from './functions/_shared/hub-renderer.js';

const html = renderHub({
  contextType: "campaign",
  contextId: "test",
  campaign: "test",
  defaultUtms: {},
  links: [],
  ga4Id: "G-123",
  metaPixelId: "P-123",
  config: {},
  slug: "test",
  slugData: { layout: [{ type: "custom_html", content: "hey" }] },
  components: [],
  isPreview: false,
  intentConfig: { layout: [{ type: "custom_html", content: "hey" }] }
});

const lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('JSON.parse')) {
    console.log((i + 1) + ": " + lines[i]);
  }
}
