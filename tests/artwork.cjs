// Pure offline tests. No live account, private data or browser automation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const ctx=vm.createContext({URL,console,structuredClone});
vm.runInContext(read('artwork-model.js')+'\n'+read('life-schema.js')+'\n'+read('game-schema.js')+'\nthis.M={validArtwork,safeArtworkUrl,titleSimilarity,chooseArtwork,scoreArtwork,artworkKey,validateLife,validateGame};',ctx);
const M=ctx.M,clean=x=>JSON.parse(JSON.stringify(x));
const poster={provider:'wikipedia',title:'Dune (2021 film)',url:'https://upload.wikimedia.org/wikipedia/en/8/8e/Dune.jpg',sourceUrl:'https://en.wikipedia.org/wiki/Dune_(2021_film)',year:2021};
assert.ok(M.validArtwork(poster));
for(const x of [null,undefined,false])assert.ok(M.validArtwork(x));
for(const url of ['javascript:alert(1)','data:image/svg+xml,<svg onload=alert(1)>','http://upload.wikimedia.org/x','https://upload.wikimedia.org.evil.test/x','https://user:secret@upload.wikimedia.org/x','https://upload.wikimedia.org:8443/x','https://evil.test/tracker']){
  assert.equal(M.safeArtworkUrl(url),'');assert.equal(M.validArtwork({...poster,url}),false);
}
for(const value of ['x',[],true,{...poster,provider:'unknown'},{...poster,sourceUrl:'https://evil.test/x'},{...poster,title:null},{...poster,year:'2021'}])assert.equal(M.validArtwork(value),false);
const item={title:'Dune',year:2021,opinion:'Mi opinión no se traduce.',myRating:0};
assert.equal(M.chooseArtwork('movie',item,[{...poster,year:1984},poster]).year,2021);
assert.equal(M.chooseArtwork('movie',item,[{...poster,year:1984}]),null,'wrong remake stays blank');
assert.equal(M.chooseArtwork('movie',item,[poster,{...poster,url:poster.url+'?other=1'}]),null,'ambiguous artwork is not auto-selected');
assert.equal(M.chooseArtwork('movie',item,[{...poster,title:'Another film'}]),null);
assert.equal(M.titleSimilarity('El padrino II','Padrino 2 (película)'),1);
assert.notEqual(M.artworkKey('movie',item),M.artworkKey('book',item));
assert.equal(M.titleSimilarity('TaxiDriver','Taxi Driver'),.99);
assert.ok(M.titleSimilarity('Succesion','Succession')>=.88);
assert.equal(M.titleSimilarity('Dune Parte Dos','Dune Part Two'),1);
assert.equal(M.chooseArtwork('movie',{title:'Salvar al soldado Ryan',year:1998},[{...poster,title:'Saving Private Ryan',aliases:['Salvar al soldado Ryan'],year:1998}]).title,'Saving Private Ryan');
const book={title:'Dune',author:'Frank Herbert',year:1965};
const cover={provider:'openlibrary',title:'Dune',creator:'Frank Herbert',year:1965,url:'https://covers.openlibrary.org/b/id/123-L.jpg?default=false',sourceUrl:'https://openlibrary.org/works/OL123W'};
assert.ok(M.chooseArtwork('book',book,[cover]));
assert.ok(M.chooseArtwork('book',book,[cover,{...cover,url:cover.url.replace('123','456')}]),'different editions of the same book can use either real cover');
assert.equal(M.chooseArtwork('book',book,[{...cover,creator:'Someone Else'}]),null);
for(const kind of ['books','movies','series','games']){
  assert.deepEqual(clean(M.validateLife({[kind]:[{...item,artwork:poster}]})),[]);
  assert.ok(M.validateLife({[kind]:[{...item,artwork:{...poster,url:'javascript:bad'}}]}).length);
}
assert.equal(M.validateGame({title:'Game',artwork:poster,myRating:0,status:'Completed'}),null);
assert.ok(M.validateGame({title:'Game',artwork:true}));
const roundtrip=JSON.parse(JSON.stringify({...item,artwork:poster}));
assert.equal(roundtrip.opinion,item.opinion);assert.equal(roundtrip.myRating,0);assert.deepEqual(roundtrip.artwork,poster);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const file of ['js/artwork-model.js','js/artwork.js','js/library.js','css/library.css'])assert.ok(sw.includes("new URL('"+file+"', APP_BASE)"));
console.log('PASS: safe HTTPS hosts, optional legacy schema, remake/year/author matching, ambiguity, ES titles, zero ratings, artwork JSON roundtrip and release precache');
