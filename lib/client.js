window.__ModuleLoader__.load({id:'dsh-server-monitor',factory(require) {
  const React = require('react'), h = React.createElement;
  const API = '/dsh-server-monitor/api';
  const card = {background:'#161b22',border:'1px solid #30363d',borderRadius:8,padding:'9px 11px'};
  const btn = {background:'#21262d',color:'#e6edf3',border:'1px solid #484f58',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:12};
  const QQ = {online:['在线','#3fb950'],offline:['未登录','#d29922'],stopped:['已退出','#8b949e'],unknown:['未知','#8b949e']};

  function Panel() {
    const [open,setOpen] = React.useState(true);
    const [data,setData] = React.useState(null);
    const [error,setError] = React.useState('');
    const [note,setNote] = React.useState('');
    const [busy,setBusy] = React.useState('');
    const [qqWindow,setQqWindow] = React.useState('');

    function load() {
      return fetch(API + '/stats', {cache:'no-store'})
        .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
        .then(d => { setData(d); setError(''); })
        .catch(e => setError(String((e && e.message) || e)));
    }
    React.useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

    function act(name, label) {
      setBusy(name); setNote(label + ' 执行中…');
      fetch(API + '/action', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:name})})
        .then(r => r.json())
        .then(d => setNote((d.ok ? '✓ ' : '✗ ') + (d.msg || '')))
        .catch(e => setNote('✗ ' + String((e && e.message) || e)))
        .then(() => { setBusy(''); load(); });
    }

    const mem = data && data.mem;
    const qq = QQ[(data && data.qq) || 'unknown'] || QQ.unknown;
    const vnc = data?.vncUrl || 'http://localhost:16081/?resize=scale';
    const pctOf = (a,b) => b ? Math.round(a / b * 100) : 0;
    const cols = d => (d || '').split(/\s+/);
    const rows = mem ? [
      ['内存', pctOf(mem.used_mb, mem.total_mb) + '%', mem.used_mb + ' / ' + mem.total_mb + ' MB'],
      ['Swap', pctOf(mem.swap_used_mb, mem.swap_total_mb) + '%', mem.swap_used_mb + ' / ' + mem.swap_total_mb + ' MB'],
      ['负载', (data.load || []).join(' / '), (data.cpu_count || '-') + ' 核'],
      ['磁盘', cols(data.disk).slice(-2)[0] || '-', cols(data.disk).slice(-3)[0] || ''],
    ] : [];
    const button = (name,label) => h('button',{key:name,style:{...btn,opacity:busy ? 0.6 : 1},disabled:!!busy,onClick:()=>act(name,label)},label);

    return h('div',{style:{position:'fixed',right:20,top:65,zIndex:1001,pointerEvents:'auto',fontFamily:'system-ui',color:'#e6edf3'}},
      !open ? h('button',{style:btn,onClick:()=>setOpen(true)},'服务器') :
      h('section',{role:'dialog','aria-label':'服务器管理',style:{width:qqWindow ? 'min(900px,calc(100vw - 40px))' : 'min(430px,calc(100vw - 40px))',maxHeight:'calc(100vh - 100px)',overflow:'auto',background:'#0e1117',border:'1px solid #484f58',borderRadius:10,boxShadow:'0 12px 48px #0008'}},
        h('header',{style:{display:'flex',alignItems:'center',gap:8,padding:'9px 11px',borderBottom:'1px solid #30363d'}},
          h('strong',{style:{flex:1,fontSize:13}},'服务器管理'),
          h('span',{style:{fontSize:12,color:qq[1]}},'QQ ' + qq[0]),
          h('button',{style:btn,onClick:load},'刷新'),
          h('button',{style:btn,onClick:()=>setOpen(false)},'收起')),
        h('div',{style:{padding:11,display:'flex',flexDirection:'column',gap:9}},
          error ? h('div',{style:{...card,borderColor:'#f85149',color:'#f85149',fontSize:12}},'连接失败：' + error) : null,
          !data && !error ? h('div',{style:{...card,fontSize:12,color:'#8b949e'}},'正在读取服务器状态…') : null,
          rows.length ? h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}},
            rows.map(([k,v,s]) => h('div',{key:k,style:card},
              h('div',{style:{fontSize:11,color:'#8b949e'}},k),
              h('div',{style:{fontSize:17,fontWeight:600}},v),
              h('div',{style:{fontSize:11,color:'#8b949e'}},s)))) : null,
          data && (data.containers || []).length ? h('div',{style:card},
            (data.containers || []).map(c => h('div',{key:c.name,style:{display:'flex',gap:8,fontSize:12,padding:'2px 0'}},
              h('span',{style:{flex:1}},c.name),
              h('span',{style:{color:'#8b949e'}},'CPU ' + c.cpu),
              h('span',{style:{color:'#8b949e'}},c.mem)))) : null,
          h('div',{style:{display:'flex',flexWrap:'wrap',gap:7}},
            button('purge_cache','清理缓存'),
            button('restart_snow','重启 SnowLuma'),
            button('restart_ast','重启 AstrBot'),
            button('restart_both','全部重启')),
          h('div',{style:{display:'flex',gap:7}},
            h('button',{style:btn,onClick:()=>setQqWindow(qqWindow === 'login' ? '' : 'login')},'QQ 登录'),
            h('button',{style:btn,onClick:()=>setQqWindow(qqWindow === 'logout' ? '' : 'logout')},'QQ 退出')),
          qqWindow ? h('div',{style:{position:'fixed',inset:0,zIndex:1002,background:'#000a',display:'flex',alignItems:'center',justifyContent:'center',padding:12,pointerEvents:'auto'}},
            h('div',{role:'dialog','aria-label':'QQ 客户端',style:{width:'min(1600px,96vw)',height:'94vh',background:'#0e1117',border:'1px solid #484f58',borderRadius:10,boxShadow:'0 12px 48px #000c',display:'flex',flexDirection:'column',overflow:'hidden'}},
              h('header',{style:{display:'flex',alignItems:'center',gap:8,padding:'9px 11px',borderBottom:'1px solid #30363d'}},
                h('strong',{style:{flex:1,fontSize:13}},qqWindow === 'login' ? 'QQ 登录：在下方客户端扫码；提示密码时输入 VNC 密码' : 'QQ 退出：在客户端菜单里选择退出登录，停止容器只会下线、不会清除登录'),
                h('button',{style:btn,onClick:()=>setQqWindow('')},'关闭')),
              vnc ? h('iframe',{title:'QQ 客户端登录与退出',src:vnc,style:{flex:1,width:'100%',border:0,background:'#111'}})
                  : h('div',{style:{padding:16,fontSize:12,color:'#8b949e'}},'QQ 客户端连接尚未就绪'))) : null,
          note ? h('div',{style:{fontSize:12,color:'#8b949e'}},note) : null,
          data ? h('div',{style:{fontSize:11,color:'#484f58'}},data.host + ' · ' + data.uptime + ' · 每 5 秒刷新') : null)));
  }

  return {name:'dsh-server-monitor',inject:['slots'],apply(ctx) {
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'server-monitor',order:45},Panel));
  }};
}});