const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const catalogSource=fs.readFileSync(path.join(root,'js/company-logo-catalog.js'),'utf8');
const modelSource=fs.readFileSync(path.join(root,'js/company-logos.js'),'utf8').split('// Keep decoded')[0].replace(/^import .*;\r?\n/gm,'');
const ctx=vm.createContext({Map,String,console});vm.runInContext(catalogSource.replace('export const','const')+modelSource.replace('export function','function')+';this.api={COMPANY_LOGOS,companyLogo};',ctx);
const {COMPANY_LOGOS,companyLogo}=ctx.api,seen=new Set();
for(const c of COMPANY_LOGOS){assert.ok(!seen.has(c.id));seen.add(c.id);assert.match(c.file,/^[a-z0-9-]+\.(png|svg|jpg|webp|ico)$/);const file=path.join(root,'icons/companies',c.file);assert.ok(fs.statSync(file).size>80);if(c.file.endsWith('.svg'))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/<script|<foreignObject|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i);}
for(const [tk,id]of [['AMR','alpha-metallurgical'],['AMR*','alpha-metallurgical'],['NTBR.L','northern-bear'],['BQE.V','bqe-water'],['RNO.PA','renault'],['ZOMD.V','zoomd'],['TGO.TO','terago'],['SPSY.L','spectra-systems'],['4386.T','sig-japan']])assert.equal(companyLogo(tk)?.id,id);
assert.equal(companyLogo('', 'ZOOMD TECHNOLOGIES LTD').id,'zoomd');assert.equal(companyLogo('ACT','Alzchem Group').id,'alzchem');assert.equal(companyLogo('TWC','TWC Enterprises').id,'twc-enterprises');assert.equal(companyLogo('UNKNOWN','Unknown Company'),null);assert.equal(companyLogo('TOT','TotalEnergies'),null);
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const c of COMPANY_LOGOS)assert.ok(worker.includes('icons/companies/'+c.file));
assert.doesNotMatch(modelSource,/fetch\(|script\.google|token|session/);
console.log('PASS: '+COMPANY_LOGOS.length+' local logos, issuer aliases, unknown fallback, safe image assets and complete offline cache.');
