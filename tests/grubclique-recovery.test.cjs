const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../GrubClique/app/app.js'),'utf8')
  .replace(/^import .*;\r?\n/gm,'').split('supabase.auth.onAuthStateChange')[0];
function harness() {
  const nodes=new Map(), storage=new Map();
  function element() {
    const classes=new Set();
    return {value:'',textContent:'',disabled:false,dataset:{},style:{},handlers:{},children:[],open:false,
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on??=!classes.has(c);on?classes.add(c):classes.delete(c);}},
      addEventListener(event,fn){this.handlers[event]=fn;},append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=items;},querySelector(){return null;},setAttribute(){},close(){this.open=false;},remove(){}};
  }
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);};
  const calls=[];
  let votes=[{restaurant_id:1}], failure=null;
  const state={invite_code:'QA',is_host:true,status:'swiping',title:'QA Hunt',members:[],matches:[],messages:[],restaurants:[
    {id:1,name:'A',cuisine:'Cafe',serves_breakfast:true},{id:2,name:'B',cuisine:'Diner',serves_breakfast:false},{id:3,name:'C',cuisine:'Cafe',serves_breakfast:true}]};
  const db={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='get_clique_state') return failure || {data:[state]};
    if(name==='get_friend_clique_state') return failure || {data:[{friend_clique_id:'g',clique_name:'QA',members:[],grub_hunts:[]}]};
    if(name==='get_clique_preferences')return {data:[{meal_periods:[],sort_mode:'default'}]};
    if(name==='undo_last_swipe')return {data:[{restaurant_id:1}]};
    return {data:[]};
  },from(name){assert.equal(name,'swipes');const query={select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:votes})};return query;}};
  const context=vm.createContext({createClient:()=>db,document:{hidden:false,querySelector:node,querySelectorAll:()=>[],createElement:element,addEventListener(){}},
    getCountries:()=>['US'],getCountryCallingCode:()=>1,
    window:{scrollTo(){},addEventListener(){}},navigator:{language:'en-US'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    setInterval:()=>1,clearInterval(){},setTimeout,URL,URLSearchParams,console,alert(){},confirm:()=>true});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run("session={user:{id:'u'}}; group={id:'g'}; clique={id:'h',status:'swiping'}; currentPanel='clique';");
  return {run,node,db,calls,state,setVotes:v=>votes=v,setFailure:f=>failure=f};
}
test('saved votes survive filtering, sorting and reopening, independent of local index',async()=>{
  const h=harness();await h.run('loadClique()');
  assert.equal(h.run('currentRestaurant().id'),2);
  h.run("localStorage.setItem('grubclique-index-h','99'); preferences.meal_periods=['breakfast']; renderRestaurant();");
  assert.equal(h.run('currentRestaurant().id'),3);
  h.run("preferences.meal_periods=[];preferences.sort_mode='name';renderRestaurant();");
  assert.equal(h.run('currentRestaurant().id'),2);
  await h.run("openGrubHunt({id:'h',status:'swiping'})");
  assert.equal(h.run('currentRestaurant().id'),2);
});
test('no eligible cards and all reviewed are distinct; account state resets',async()=>{
  const h=harness();h.setVotes([{restaurant_id:1},{restaurant_id:2},{restaurant_id:3}]);await h.run('loadClique()');h.run('renderRestaurant()');
  assert.equal(h.run('currentRestaurant()'),undefined);assert.match(h.node('#restaurant-meta').textContent,/Wait for/);
  h.run("localFilters.cuisine='Missing';renderRestaurant()");assert.match(h.node('#restaurant-meta').textContent,/No restaurants match/);
  h.run('resetHuntProgress()');assert.equal(h.run('votedIds.size'),0);assert.equal(h.run('votesReady'),false);
});
test('duplicate taps submit once and a match continues to the next unreviewed card',async()=>{
  const h=harness();await h.run('loadClique()');let complete;let writes=0;
  h.db.rpc=async(name)=>{if(name==='record_swipe'){writes++;return new Promise(r=>complete=r);}return {data:[]};};
  const first=h.run('recordSwipe(true)');await h.run('recordSwipe(true)');assert.equal(writes,1);
  complete({data:[{matched:true}]});await first;
  assert.equal(h.run('currentRestaurant().id'),3);assert.equal(h.node('#match-card').classList.contains('hidden'),false);
  h.node('#dismiss-match').handlers.click();assert.equal(h.node('#match-card').classList.contains('hidden'),true);
  assert.equal(h.run('currentRestaurant().id'),3);assert.equal(h.run("votedIds.has('2')"),true);
});
test('Undo restores the returned restaurant identity, not the previous filtered position',async()=>{
  const h=harness();await h.run('loadClique()');h.setVotes([]);
  await h.node('#undo-swipe').handlers.click();
  assert.equal(h.run('currentRestaurant().id'),1);assert.equal(h.run("votedIds.has('1')"),false);
});
test('confirmed lost membership clears state and cannot reopen a stale screen',async()=>{
  const h=harness();h.setFailure({error:{message:'Clique membership required'}});await h.run('loadClique()');
  assert.equal(h.run('clique'),null);assert.equal(h.run('group'),null);assert.equal(h.run('currentPanel'),'cliques');
  h.run("showPanel('swipe')");assert.equal(h.run('currentPanel'),'cliques');assert.equal(h.run('votesReady'),false);
});
test('empty successful overview also clears access; network errors do not',async()=>{
  const h=harness();h.setFailure({error:{message:'Failed to fetch'}});await h.run('loadGroup()');assert.equal(h.run('group.id'),'g');
  h.setFailure({data:[]});await h.run('loadGroup()');assert.equal(h.run('group'),null);
});
test('failed saved-vote read prevents guessing the next card',async()=>{
  const h=harness();h.run("readSwipeIds=async()=>({error:{message:'Offline'}})");await h.run('loadClique()');h.run('renderRestaurant()');
  assert.equal(h.run('votesReady'),false);assert.equal(h.node('#like').disabled,true);assert.equal(h.node('#start-swiping').disabled,true);
});
test('a late refresh cannot overwrite a vote committed after it started',async()=>{
  const h=harness();await h.run('loadClique()');const original=h.db.rpc;let finish;
  h.db.rpc=(name,args)=>name==='get_clique_state'?new Promise(r=>finish=r):original(name,args);
  const poll=h.run('loadClique()');await h.run('recordSwipe(false)');finish({data:[h.state]});await poll;
  assert.equal(h.run("votedIds.has('2')"),true);assert.equal(h.run('currentRestaurant().id'),3);
});
test('late old-account response is discarded',async()=>{
  const h=harness();let finish;const original=h.db.rpc;
  h.db.rpc=(name,args)=>name==='get_clique_state'?new Promise(r=>finish=r):original(name,args);
  const poll=h.run('loadClique()');h.run("session={user:{id:'other'}};resetHuntProgress()");finish({data:[h.state]});await poll;
  assert.equal(h.run('votesReady'),false);assert.equal(h.run('votedIds.size'),0);
});
test('finished hunts cannot record votes',async()=>{
  const h=harness();await h.run('loadClique()');h.run("clique.status='finished'");await h.run('recordSwipe(true)');
  assert.equal(h.calls.filter(c=>c.name==='record_swipe').length,0);
});
