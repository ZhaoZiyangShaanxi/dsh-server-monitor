import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Readable} from 'node:stream';
let handler, forwarded, sshArgs;
const cleanups=[];
const source=readFileSync(new URL('./lib/index.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
const box={spawn:(_cmd,args)=>{sshArgs=args;return {once(){},kill(){}};},homedir:()=>'/user',join:(...p)=>p.join('/'),setTimeout,clearTimeout,URL,AbortSignal,process:{env:{}},readFileSync:()=>'{"host":"root@server","identityFile":"key"}',
 fetch:async(url,opts)=>{forwarded={url,opts};return {status:200,text:async()=>url.endsWith('/api/stats')?'{}':'fetch("/api/stats")'};}};
vm.createContext(box);vm.runInContext(source+';this.activate=apply;',box);
box.activate({effect(fn){const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);},webServer:{register(route){handler=route.handler;return ()=>{};}}});
async function request(path,method='GET',body='',origin='http://localhost:43120'){
 const req=Readable.from(body?[Buffer.from(body)]:[]);Object.assign(req,{url:'/dsh-server-monitor'+path,method,headers:{host:'localhost:43120',...(origin?{origin}:{})}});
 const res={status:0,body:'',writeHead(s,h){this.status=s;this.headers=h;},end(b){this.body=b;}};await handler(req,res);return res;
}
assert.equal((await request('/')).body,'fetch("/dsh-server-monitor/api/stats")');
assert.equal(JSON.parse((await request('/api/stats')).body).vncUrl,'http://localhost:16081/?resize=scale');
assert.equal(sshArgs.filter(a=>a.startsWith('127.0.0.1:')).length,2);
assert.equal((await request('/api/action','POST','{"action":"restart_ast"}','http://evil.test')).status,403);
assert.equal((await request('/api/action','POST','{"action":"restart_ast"}',null)).status,403);
assert.equal((await request('/api/action','POST','{"action":"shell"}')).status,400);
assert.equal((await request('/api/action','POST','{"action":"purge_cache"}')).status,200);
assert.equal(forwarded.opts.body,'{"action":"purge_cache"}');
assert.equal((await request('/api/action','POST','{"action":"qq_login"}')).status,400);
assert.equal((await request('/api/action','POST','{"action":"qq_logout"}')).status,400);
assert.equal((await request('/unexpected')).status,404);
for(const fn of cleanups)fn();
let plugin,registration;
vm.runInNewContext(readFileSync(new URL('./lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(p){plugin=p;}}}});
const React={createElement:(tag,props,...children)=>({tag,props,children}),useState:v=>[v,()=>{}],useEffect:()=>{},useRef:v=>({current:v})};
plugin.factory(()=>React).apply({slots:{inject(n,fn){fn();},register(opts,component){registration={opts,component};}}});
assert.equal(registration.opts.name,'shell.overlay');
assert.match(JSON.stringify(registration.component()),/服务器管理/);
assert.match(JSON.stringify(registration.component()),/QQ 登录/);
assert.match(JSON.stringify(registration.component()),/QQ 退出/);
const state=[true,{qq:'unknown',vncUrl:'http://localhost:16081/?resize=scale',containers:[],host:'test',uptime:'up'},'','','',''];
let hook=0;
React.useState=v=>{const i=hook++;return [state[i]??v,next=>{state[i]=typeof next==='function'?next(state[i]):next;}];};
const render=()=>{hook=0;return registration.component();};
function find(node,predicate){
 if(!node || typeof node!=='object')return undefined;
 if(predicate(node))return node;
 return (node.children||[]).map(child=>find(child,predicate)).find(Boolean);
}
let tree=render();
find(tree,n=>n.tag==='button'&&n.children[0]==='QQ 登录').props.onClick();
tree=render();
assert.equal(find(tree,n=>n.tag==='iframe').props.src,'http://localhost:16081/?resize=scale');
find(tree,n=>n.tag==='button'&&n.children[0]==='QQ 退出').props.onClick();
assert.match(JSON.stringify(render()),/停止容器只会下线/);
console.log('PASS: proxy CSRF and allowlist, VNC tunnel URL, manual QQ login/logout panel');
