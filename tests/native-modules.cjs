const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),modules=new Map();
function moduleAt(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const module=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{identifier:file});modules.set(file,module);return module;}
(async()=>{const entry=moduleAt(path.join(root,'new/app.js'));await entry.link((specifier,ref)=>{if(!specifier.startsWith('.'))throw Error('Unexpected dependency: '+specifier);return moduleAt(path.resolve(path.dirname(ref.identifier),specifier));});console.log('PASS: '+modules.size+' native-client modules link with no missing files or exports.');})().catch(e=>{console.error(e);process.exitCode=1;});
