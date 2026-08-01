const fs = require('fs');

const innovioHTML = fs.readFileSync('C:\\\\Users\\\\César\\\\OneDrive\\\\Documentos\\\\PROYECTOS\\\\Hoja de Servicio\\\\innovio-billing2.html', 'utf8');
const base64Match = innovioHTML.match(/src="(data:image\\/jpeg;base64,[^"]+)"/);

if (!base64Match) {
  console.log("Not found base64 in innovio-billing2.html");
  process.exit(1);
}

const base64Src = base64Match[1];

const wizardPath = 'C:\\\\Users\\\\César\\\\OneDrive\\\\Documentos\\\\PROYECTOS\\\\Hoja de Servicio 2.0.1\\\\src\\\\views\\\\wizard.js';
let wizardJS = fs.readFileSync(wizardPath, 'utf8');

const targetStr = `<div style="width:38px; height:38px; background:var(--verde); color:#fff; display:flex; align-items:center; justify-content:center; border-radius:6px; font-weight:900; font-size:20px;">I</div>
            <div>
              <div class="brand-name">INNOVIO</div>
              <div class="brand-tagline">Simplificando el Futuro</div>
            </div>`;

const replacement = `<img class="brand-logo-big" src="${base64Src}" alt="INNOVIO" />
            <div style="display:none;">
              <div class="brand-name">INNOVIO</div>
              <div class="brand-tagline">Simplificando el Futuro</div>
            </div>`;

if(wizardJS.includes(targetStr)) {
    wizardJS = wizardJS.replace(targetStr, replacement);
    fs.writeFileSync(wizardPath, wizardJS, 'utf8');
    console.log("Success! Image injected.");
} else {
    console.log("Could not find target string in wizard.js");
}
