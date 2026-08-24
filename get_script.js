import { renderHub } from './functions/_shared/hub-renderer.js';
import fs from 'fs';

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

const scriptStart = html.lastIndexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
const scriptContent = html.substring(scriptStart + 8, scriptEnd);

fs.writeFileSync('extracted_script.js', scriptContent);
