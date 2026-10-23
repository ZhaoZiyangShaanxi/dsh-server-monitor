window.__ModuleLoader__.load({id:'dsh-server-monitor',factory(require) {
  const React = require('react'), h = React.createElement;
  function Panel() {
    const [open,setOpen] = React.useState(true);
    const [revision,setRevision] = React.useState(0);
    const common = {pointerEvents:'auto',fontFamily:'system-ui',color:'#e6edf3'};
    const button = {background:'#21262d',color:'#e6edf3',border:'1px solid #484f58',borderRadius:6,padding:'7px 12px',cursor:'pointer'};
    return h('div', {style:{...common,position:'fixed',right:20,top:65,zIndex:1001}},
      !open ? h('button',{style:button,onClick:()=>setOpen(true),'aria-label':'open server monitor'},'服务器') :
      h('section', {role:'dialog','aria-label':'server monitor',style:{background:'#0e1117',border:'1px solid #484f58',borderRadius:10,width:'min(760px, calc(100vw - 40px))',height:'min(680px, calc(100vh - 100px))',display:'flex',flexDirection:'column',boxShadow:'0 12px 48px #0008',overflow:'hidden'}},
        h('header',{style:{display:'flex',alignItems:'center',gap:10,padding:10,borderBottom:'1px solid #30363d'}},
          h('strong',{style:{flex:1}},'服务器管理'),
          h('button',{style:button,onClick:()=>setRevision(n=>n+1)},'刷新'),
          h('button',{style:button,onClick:()=>setOpen(false),'aria-label':'collapse server monitor'},'收起')),
        h('iframe',{key:revision,title:'server resources',src:'/dsh-server-monitor/',style:{width:'100%',flex:1,border:0,background:'#0e1117'}})));
  }
  return {name:'dsh-server-monitor',inject:['slots'],apply(ctx) {
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'server-monitor',order:45},Panel));
  }};
}});
