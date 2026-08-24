import fs from 'fs';
let code = fs.readFileSync('functions/api/decision/signal.js', 'utf8');

const target1 = `        const intentData = await context.env.APP_CONFIG.get(\`campaign:\${campaignId}\`, { type: "json" });`;
const replace1 = `
        const intentData = await context.env.APP_CONFIG.get(\`campaign:\${campaignId}\`, { type: "json" });
        const slug = body.meta?.slug;
        let landingData = null;
        if (slug) {
          try {
            landingData = await context.env.APP_CONFIG.get(\`landing:\${slug}\`, { type: "json" });
          } catch(e) {}
        }
`;
code = code.replace(target1, replace1);

const target2 = `const evalCfg = intentData?.evaluation || intentData?.routing?.evaluation;`;
const replace2 = `const evalCfg = landingData?.signals || intentData?.evaluation || intentData?.routing?.evaluation;`;
code = code.replace(target2, replace2);

fs.writeFileSync('functions/api/decision/signal.js', code);
console.log("signal patched to read landing config");
