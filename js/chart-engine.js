window.ChartEngine = (() => {
  function niceRange(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
    if (min === max) { const d = Math.max(1, Math.abs(min) * 0.15); return [min-d, max+d]; }
    const d = (max-min)*0.08; return [min-d, max+d];
  }

  // 手动坐标范围：任一端点为有限数即生效，另一端退回自动范围。
  function resolveRange(lo, hi, autoLo, autoHi) {
    const hasLo = Number.isFinite(lo), hasHi = Number.isFinite(hi);
    let a = hasLo ? lo : autoLo, b = hasHi ? hi : autoHi;
    if (!(b > a)) {
      if (hasLo && !hasHi) b = a + Math.max(1e-6, Math.abs(a) * 0.2);
      else if (!hasLo && hasHi) a = b - Math.max(1e-6, Math.abs(b) * 0.2);
      else if (hasLo && hasHi) b = a + Math.max(1e-6, Math.abs(a) * 0.2);
      else { a = autoLo; b = autoHi; }
    }
    if (!(b > a)) { a = a - 0.5; b = b + 0.5; }
    return [a, b];
  }

  // 标注防重叠：密集处只保留能放下的标注，避免文字互相压叠
  function fits(drawn, r, gapX, gapY) {
    const gx = gapX == null ? 3 : gapX, gy = gapY == null ? 2 : gapY;
    return !drawn.some(o =>
      Math.abs((o.x + o.w / 2) - (r.x + r.w / 2)) < ((o.w + r.w) / 2 + gx) &&
      Math.abs((o.y + o.h / 2) - (r.y + r.h / 2)) < ((o.h + r.h) / 2 + gy));
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function draw(canvas, data, xKey, yKey, labels, range) {
    range = range || {};
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(500, Math.floor(rect.width || 800));
    const h = Math.max(300, Math.floor(rect.height || 360));
    canvas.width = w*dpr; canvas.height = h*dpr;
    canvas.style.cursor = data.length ? 'crosshair' : 'default';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    if (!data.length) {
      canvas.__chartMeta = null;
      ctx.fillStyle='#718096'; ctx.font='13px Segoe UI, Microsoft YaHei, sans-serif';
      ctx.fillText('建立轨迹后显示数据曲线', 20, 30);
      return;
    }
    const pad={l:68,r:24,t:32,b:52}; const pw=w-pad.l-pad.r; const ph=h-pad.t-pad.b;
    const x=data.map(d=>Number.isFinite(Number(d[xKey]))?Number(d[xKey]):0);
    const y=data.map(d=>Number.isFinite(Number(d[yKey]))?Number(d[yKey]):0);
    const [ax0,ax1]=niceRange(Math.min(...x),Math.max(...x));
    const [ay0,ay1]=niceRange(Math.min(...y),Math.max(...y));
    const manual={x:Number.isFinite(range.xMin)||Number.isFinite(range.xMax),y:Number.isFinite(range.yMin)||Number.isFinite(range.yMax)};
    const [xmin,xmax]=resolveRange(range.xMin,range.xMax,ax0,ax1);
    const [ymin,ymax]=resolveRange(range.yMin,range.yMax,ay0,ay1);
    const sx=v=>pad.l+(v-xmin)/(xmax-xmin)*pw, sy=v=>pad.t+ph-(v-ymin)/(ymax-ymin)*ph;
    const inside=data.some((d,i)=>x[i]>=xmin&&x[i]<=xmax&&y[i]>=ymin&&y[i]<=ymax);
    canvas.__chartMeta={data,xKey,yKey,labels,xmin,xmax,ymin,ymax,pad,pw,ph,w,h,sx,sy,dpr,color:'#2463eb',manual,inside,auto:{xmin:ax0,xmax:ax1,ymin:ay0,ymax:ay1}};

    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    // 网格与坐标
    ctx.strokeStyle='#e9eef5'; ctx.lineWidth=1;
    for(let i=0;i<=6;i++){
      const yy=pad.t+i*ph/6, xx=pad.l+i*pw/6;
      ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(pad.l+pw,yy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,pad.t+ph);ctx.stroke();
    }
    ctx.strokeStyle='#8b98a9'; ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();

    ctx.fillStyle='#66758a'; ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif';
    ctx.textAlign='center';
    for(let i=0;i<=6;i++){const v=xmin+(xmax-xmin)*i/6;ctx.fillText(formatTick(v),pad.l+i*pw/6,h-19);} 
    ctx.textAlign='right';
    for(let i=0;i<=6;i++){const v=ymax-(ymax-ymin)*i/6;ctx.fillText(formatTick(v),pad.l-9,pad.t+i*ph/6+4);} 
    ctx.fillStyle='#334155';ctx.font='700 12px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.fillText(labels.x,pad.l+pw/2,h-2);
    ctx.save();ctx.translate(16,pad.t+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(labels.y,0,0);ctx.restore();

    // 标题信息
    const titleText=`${labels.y} · ${labels.x}`;
    ctx.textAlign='left';ctx.fillStyle='#334155';ctx.font='700 12px Segoe UI, Microsoft YaHei, sans-serif';ctx.fillText(titleText,pad.l,18);

    // 手动范围角标：提示当前不是自动范围
    if(manual.x||manual.y){
      ctx.font='700 10px Segoe UI, Microsoft YaHei, sans-serif';
      const tag=manual.x&&manual.y?'手动范围 x·y':manual.x?'手动范围 x':'手动范围 y';
      const tw=ctx.measureText(tag).width;
      const tx=pad.l+ctx.measureText(titleText).width+12;
      ctx.fillStyle='#eef4ff';ctx.strokeStyle='#c7d9fb';ctx.lineWidth=1;
      roundRectPath(ctx,tx,8,tw+16,18,9);ctx.fill();ctx.stroke();
      ctx.fillStyle='#2463eb';ctx.fillText(tag,tx+8,21);
    }

    // 曲线裁剪在绘图区内，避免手动范围放大时曲线画到坐标轴外
    ctx.save();
    ctx.beginPath();ctx.rect(pad.l,pad.t,pw,ph);ctx.clip();

    // 曲线下面积填充：浅色填充增强趋势可读性
    ctx.beginPath();
    ctx.moveTo(sx(x[0]),pad.t+ph);
    for(let i=0;i<data.length;i++)ctx.lineTo(sx(x[i]),sy(y[i]));
    ctx.lineTo(sx(x[data.length-1]),pad.t+ph);
    ctx.closePath();
    ctx.fillStyle='rgba(36,99,235,.08)';
    ctx.fill();

    // 轨迹曲线
    ctx.beginPath();
    for(let i=0;i<data.length;i++){const px=sx(x[i]),py=sy(y[i]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.strokeStyle='#2463eb';ctx.lineWidth=2.5;ctx.stroke();

    const step=Math.max(1,Math.floor(data.length/180));
    ctx.fillStyle='#2463eb';
    for(let i=0;i<data.length;i+=step){ctx.beginPath();ctx.arc(sx(x[i]),sy(y[i]),2.4,0,Math.PI*2);ctx.fill();}
    const first=data[0], last=data[data.length-1];
    [[first,'起点'],[last,'终点']].forEach(([d,label])=>{const px=sx(Number(d[xKey])||0),py=sy(Number(d[yKey])||0);ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#2463eb';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#334155';ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='left';ctx.fillText(label,px+8,py-8);});
    ctx.restore();

    ctx.textAlign='right';ctx.fillStyle='#718096';ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';ctx.fillText(`数据点 ${data.length}`,w-12,18);
    if(!inside){
      ctx.textAlign='center';ctx.fillStyle='#b23b3b';ctx.font='12px Segoe UI, Microsoft YaHei, sans-serif';
      ctx.fillText('当前坐标范围不包含数据点，请调整范围或点击“自动范围”',pad.l+pw/2,pad.t+ph/2);
    }
    ctx.textAlign='left';
  }

  function formatTick(v){
    const av=Math.abs(v);
    if(av>=1000|| (av>0 && av<0.001)) return v.toExponential(1);
    if(av>=100) return v.toFixed(0);
    if(av>=10) return v.toFixed(1);
    if(av>=1) return v.toFixed(2);
    return v.toFixed(3);
  }

  function hitTest(canvas, e){
    const meta=canvas.__chartMeta; if(!meta||!meta.data.length)return null;
    const r=canvas.getBoundingClientRect();
    const xPx=e.clientX-r.left, yPx=e.clientY-r.top;
    if(xPx<meta.pad.l||xPx>meta.pad.l+meta.pw||yPx<meta.pad.t||yPx>meta.pad.t+meta.ph)return null;
    let bestIndex=-1,bestDist=Infinity;
    for(let i=0;i<meta.data.length;i++){
      const d=meta.data[i];
      const xv=Number.isFinite(Number(d[meta.xKey]))?Number(d[meta.xKey]):0;
      const yv=Number.isFinite(Number(d[meta.yKey]))?Number(d[meta.yKey]):0;
      const px=meta.sx(xv), py=meta.sy(yv);
      const dist=Math.hypot(px-xPx,py-yPx);
      if(dist<bestDist){bestDist=dist;bestIndex=i;}
    }
    if(bestIndex<0 || bestDist>32)return null;
    return {data:meta.data[bestIndex],index:bestIndex,canvasX:xPx,canvasY:yPx};
  }

  function drawXOY(canvas, data, meta={}) {
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(560,Math.floor(rect.width||900));
    const h=Math.max(340,Math.floor(rect.height||380));
    canvas.width=w*dpr; canvas.height=h*dpr;
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    if(!data.length){ctx.fillStyle='#718096';ctx.font='13px Segoe UI, Microsoft YaHei, sans-serif';ctx.fillText('建立轨迹后显示 XOY 轨迹图',20,30);return;}
    const xs=data.map(d=>Number(d.x)||0), ys=data.map(d=>Number(d.y)||0);
    let xmin=Math.min(...xs,0), xmax=Math.max(...xs,0), ymin=Math.min(...ys,0), ymax=Math.max(...ys,0);
    const pad={l:58,r:24,t:28,b:48}; const pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    // 等比例绘制（x、y 每米对应相同像素，轨迹形状不失真）：先按数据范围定比例，
    // 再把较空的一轴扩到画布尺寸，让轨迹图铺满整块画布而不是缩在中间。
    const padRatio=0.15;
    const spanX=Math.max(1e-6,(xmax-xmin)*(1+2*padRatio));
    const spanY=Math.max(1e-6,(ymax-ymin)*(1+2*padRatio));
    const scale=Math.min(pw/spanX,ph/spanY);
    const plotW=pw, plotH=ph;
    const cx=(xmin+xmax)/2, cy=(ymin+ymax)/2;
    xmin=cx-plotW/scale/2; xmax=cx+plotW/scale/2;
    ymin=cy-plotH/scale/2; ymax=cy+plotH/scale/2;
    const ox=pad.l, oy=pad.t;
    const sx=v=>ox+(v-xmin)*scale; const sy=v=>oy+plotH-(v-ymin)*scale;

    // 网格
    ctx.strokeStyle='#edf1f5';ctx.lineWidth=1;
    for(let i=0;i<=10;i++){
      const x=ox+plotW*i/10,y=oy+plotH*i/10;
      ctx.beginPath();ctx.moveTo(x,oy);ctx.lineTo(x,oy+plotH);ctx.stroke();
      ctx.beginPath();ctx.moveTo(ox,y);ctx.lineTo(ox+plotW,y);ctx.stroke();
    }
    // X/Y 轴：永远显示，用户不再需要从下方选择 x/y 才能看到运动轨迹。
    const x0=Math.max(ox,Math.min(ox+plotW,sx(0)));
    const y0=Math.max(oy,Math.min(oy+plotH,sy(0)));
    ctx.strokeStyle='#64748b';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(ox,y0);ctx.lineTo(ox+plotW,y0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x0,oy+plotH);ctx.lineTo(x0,oy);ctx.stroke();
    ctx.fillStyle='#334155';ctx.font='700 12px Segoe UI, Microsoft YaHei, sans-serif';
    ctx.fillText('X / m',ox+plotW-38,y0-8); ctx.fillText('Y / m',x0+8,oy+12);
    ctx.fillStyle='#64748b';ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';
    ctx.fillText('O (0,0)',x0+6,y0+14);
    // 轨迹线
    ctx.beginPath();
    data.forEach((d,i)=>{const px=sx(Number(d.x)||0),py=sy(Number(d.y)||0);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
    ctx.strokeStyle='#2463eb';ctx.lineWidth=2.5;ctx.stroke();
    // 采样点
    const step=Math.max(1,Math.floor(data.length/180));
    for(let i=0;i<data.length;i+=step){const px=sx(xs[i]),py=sy(ys[i]);ctx.beginPath();ctx.arc(px,py,2.4,0,Math.PI*2);ctx.fillStyle='#2463eb';ctx.fill();}
    // 首尾标记
    [[data[0],'起点'],[data[data.length-1],'终点']].forEach(([d,label])=>{
      const px=sx(Number(d.x)||0),py=sy(Number(d.y)||0);
      ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#2463eb';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#334155';ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif';
      // 靠近右边界时把文字翻到左侧，避免被画布裁掉
      if(px>ox+plotW-56){ctx.textAlign='right';ctx.fillText(label,px-9,py-8);ctx.textAlign='left';}
      else ctx.fillText(label,px+8,py-8);
    });

    // 等时间间隔频闪标记：相邻点的间距直接反映该段位移大小，
    // 是判断“匀速 / 匀加速 / 变加速”最直观的课堂手段。
    const marks=meta.strobeMarks||[];
    if(meta.showStrobe!==false && marks.length>1){
      ctx.save();
      ctx.setLineDash([5,4]);
      ctx.beginPath();
      marks.forEach((m,i)=>{const px=sx(Number(m.x)||0),py=sy(Number(m.y)||0);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
      ctx.strokeStyle='rgba(217,119,6,.7)';ctx.lineWidth=1.6;ctx.stroke();
      ctx.setLineDash([]);
      const drawn=[];
      marks.forEach((m,i)=>{
        const px=sx(Number(m.x)||0), py=sy(Number(m.y)||0);
        if(i>0){
          const q=marks[i-1];
          const qx=sx(Number(q.x)||0), qy=sy(Number(q.y)||0);
          const mx=(px+qx)/2, my=(py+qy)/2;
          const chord=Math.hypot(px-qx,py-qy);
          const label=`Δs=${(Number(m.ds)||0).toFixed(3)}`;
          ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='center';
          const tw=ctx.measureText(label).width;
          const ly=Math.max(pad.t+12,Math.min(pad.t+ph-4,my+20));
          const box={x:mx-tw/2-5,y:ly-12,w:tw+10,h:15};
          // 弦太短或与已有标注重叠时只画点、不画文字，数值由纸带与结论文本给出
          if(chord>=34&&fits(drawn,box)){
            ctx.fillStyle='rgba(255,251,235,.94)';ctx.strokeStyle='rgba(217,119,6,.35)';ctx.lineWidth=1;
            roundRectPath(ctx,box.x,box.y,box.w,box.h,4);ctx.fill();ctx.stroke();
            ctx.fillStyle='#92400e';ctx.fillText(label,mx,ly-1);
            drawn.push(box);
          }
        }
        ctx.beginPath();ctx.arc(px,py,i===0?5.4:4.4,0,Math.PI*2);
        ctx.fillStyle=i===0?'#fff':'#f59e0b';ctx.fill();
        ctx.strokeStyle='#d97706';ctx.lineWidth=1.8;ctx.stroke();
        ctx.fillStyle='#b45309';ctx.font='700 10px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='center';
        const tag=String(m.seq), tw2=ctx.measureText(tag).width+4;
        const numBox={x:px-tw2/2,y:py-20,w:tw2,h:13};
        if(fits(drawn,numBox,1,1)){ctx.fillText(tag,px,py-8);drawn.push(numBox);}
      });
      ctx.restore();
    }

    ctx.fillStyle='#64748b';ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif';ctx.textAlign='left';
    const strobeNote=(meta.showStrobe!==false&&marks.length>1&&meta.strobeDt)?` · 频闪 ${Number(meta.strobeDt).toFixed(3)} s（橙点=等时间间隔位置）`:'';
    ctx.fillText(`数据点 ${data.length}${meta.fps?` · 视频 ${meta.fps.toFixed(2)} fps`:''}${strobeNote}`,14,h-14);
    ctx.textAlign='left';
  }
  // 迷你趋势图：紧凑面积图，用于“各物理量随时间变化总览”网格。
  // 写入与 draw() 相同结构的 __chartMeta，因此 hitTest 可直接复用。
  function drawMini(canvas, data, yKey, opts={}) {
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(120,Math.floor(rect.width||240));
    const h=Math.max(60,Math.floor(rect.height||84));
    canvas.width=w*dpr; canvas.height=h*dpr;
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const color=opts.color||'#2463eb';
    canvas.__chartMeta=null;
    if(!data.length){
      ctx.fillStyle='#94a0af'; ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif';
      ctx.fillText('等待轨迹数据',10,h/2+4);
      return;
    }
    const pad={l:8,r:8,t:8,b:14};
    const pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    const ts=data.map(d=>Number(d.t)||0);
    const ys=data.map(d=>Number.isFinite(Number(d[yKey]))?Number(d[yKey]):0);
    let ymin=Math.min(...ys), ymax=Math.max(...ys);
    if(ymin===ymax){const d0=Math.max(1e-6,Math.abs(ymin)*.25);ymin-=d0;ymax+=d0;}
    const span=ymax-ymin; ymin-=span*.08; ymax+=span*.08;
    const tmin=ts[0], tmax=Math.max(tmin+1e-9,ts[ts.length-1]);
    const sx=v=>pad.l+(v-tmin)/(tmax-tmin)*pw;
    const sy=v=>pad.t+ph-(v-ymin)/(ymax-ymin)*ph;
    canvas.__chartMeta={data,xKey:'t',yKey,labels:null,pad,pw,ph,w,h,sx,sy,dpr,color};

    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    if(ymin<0&&ymax>0){
      const y0=sy(0);
      ctx.strokeStyle='#e6eaf0'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(pad.l,y0); ctx.lineTo(pad.l+pw,y0); ctx.stroke(); ctx.setLineDash([]);
    }
    const base=Math.max(pad.t,Math.min(pad.t+ph,sy(0)));
    ctx.beginPath(); ctx.moveTo(sx(ts[0]),base);
    for(let i=0;i<ys.length;i++)ctx.lineTo(sx(ts[i]),sy(ys[i]));
    ctx.lineTo(sx(ts[ts.length-1]),base); ctx.closePath();
    ctx.fillStyle=color+'1e'; ctx.fill();
    ctx.beginPath();
    for(let i=0;i<ys.length;i++){const px=sx(ts[i]),py=sy(ys[i]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
    const lx=sx(ts[ts.length-1]), ly=sy(ys[ys.length-1]);
    ctx.beginPath(); ctx.arc(lx,ly,3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=1.6; ctx.stroke();
    ctx.fillStyle='#9aa6b5'; ctx.font='9px Segoe UI, Microsoft YaHei, sans-serif';
    ctx.textAlign='left'; ctx.fillText(formatTick(tmin),pad.l,h-3);
    ctx.textAlign='right'; ctx.fillText(formatTick(tmax),pad.l+pw,h-3);
    ctx.textAlign='left';
  }

  // 十字准线：在主图或迷你图上标记悬停的数据点
  function drawCrosshair(canvas, hit) {
    const meta=canvas.__chartMeta; if(!meta||!hit)return;
    const ctx=canvas.getContext('2d');
    const yv=Number.isFinite(Number(hit.data[meta.yKey]))?Number(hit.data[meta.yKey]):0;
    const xv=Number.isFinite(Number(hit.data[meta.xKey]))?Number(hit.data[meta.xKey]):0;
    const px=meta.sx(xv), py=meta.sy(yv);
    ctx.save();
    ctx.strokeStyle='rgba(100,116,139,.55)'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(hit.canvasX,meta.pad.t); ctx.lineTo(hit.canvasX,meta.pad.t+meta.ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(px,py,4.2,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle=meta.color||'#2463eb'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  }

  // 频闪纸带：把等时间间隔点按“累计位移”排布，点距 ∝ 每段位移。
  // 相当于课堂上的打点纸带：间距相同→匀速，间距均匀变大→匀加速。
  function drawStrobeStrip(canvas, marks, opts={}) {
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(320,Math.floor(rect.width||800));
    const h=Math.max(96,Math.floor(rect.height||120));
    canvas.width=w*dpr; canvas.height=h*dpr;
    const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    canvas.__strobeMeta=null;
    if(!marks||marks.length<2){
      ctx.fillStyle='#94a0af'; ctx.font='11px Segoe UI, Microsoft YaHei, sans-serif'; ctx.textAlign='left';
      ctx.fillText('建立轨迹后显示频闪纸带',12,h/2+4);
      return;
    }
    const pad={l:26,r:26};
    const pw=Math.max(20,w-pad.l-pad.r);
    const cum=marks.map(m=>Number(m.cum)||0);
    const total=Math.max(1e-9,cum[cum.length-1]);
    const X=v=>pad.l+(v/total)*pw;
    const yBase=Math.round(h*0.46);
    canvas.__strobeMeta={marks,cum,total,pad,yBase,X,w,h};

    ctx.fillStyle='#f7f9fc'; ctx.strokeStyle='#e3e9f2'; ctx.lineWidth=1;
    roundRectPath(ctx,pad.l-10,yBase-15,pw+20,30,8); ctx.fill(); ctx.stroke();

    const drawn=[];

    // 序号（密集时自动省略，保证可读）
    ctx.font='700 10px Segoe UI, Microsoft YaHei, sans-serif'; ctx.textAlign='center';
    marks.forEach((m,i)=>{
      const tag=String(m.seq), tw=ctx.measureText(tag).width+3, x=X(cum[i]);
      const box={x:x-tw/2,y:yBase-32,w:tw,h:14};
      if(fits(drawn,box,1,1)){ ctx.fillStyle='#b45309'; ctx.fillText(tag,x,yBase-22); drawn.push(box); }
    });

    // 每段位移与相邻增量（两行各自独立避让）
    const drawnDelta=[];
    const ds=marks.slice(1).map(m=>Number(m.ds)||0);
    for(let i=1;i<marks.length;i++){
      const xa=X(cum[i-1]), xb=X(cum[i]), mid=(xa+xb)/2;
      ctx.strokeStyle='rgba(217,119,6,.45)'; ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(xa,yBase+17);ctx.lineTo(xb,yBase+17);ctx.stroke();
      ctx.beginPath();ctx.moveTo(xa,yBase+13);ctx.lineTo(xa,yBase+21);ctx.stroke();
      ctx.beginPath();ctx.moveTo(xb,yBase+13);ctx.lineTo(xb,yBase+21);ctx.stroke();
      ctx.textAlign='center';
      const label=`${ds[i-1].toFixed(3)} m`;
      ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';
      const tw=ctx.measureText(label).width+4;
      const box={x:mid-tw/2,y:yBase+28,w:tw,h:13};
      if(fits(drawn,box,2,1)){ ctx.fillStyle='#92400e'; ctx.fillText(label,mid,yBase+35); drawn.push(box); }
      if(opts.showDelta!==false&&i>1){
        const d=ds[i-1]-ds[i-2];
        const t2=`${d>=0?'+':''}${d.toFixed(3)}`;
        ctx.font='9px Segoe UI, Microsoft YaHei, sans-serif';
        const tw2=ctx.measureText(t2).width+4;
        const box2={x:mid-tw2/2,y:yBase+40,w:tw2,h:12};
        if(fits(drawnDelta,box2,2,1)){ ctx.fillStyle='#a16207'; ctx.fillText(t2,mid,yBase+48); drawnDelta.push(box2); }
      }
    }

    // 频闪点：密集时自动缩小半径，避免糊成一团
    let minGap=Infinity;
    for(let i=1;i<marks.length;i++)minGap=Math.min(minGap,X(cum[i])-X(cum[i-1]));
    const rDot=Math.max(2.6,Math.min(5.2,(Number.isFinite(minGap)?minGap:10)*0.34));
    marks.forEach((m,i)=>{
      const x=X(cum[i]);
      ctx.beginPath(); ctx.arc(x,yBase,rDot,0,Math.PI*2);
      ctx.fillStyle=i===0?'#fff':'#f59e0b'; ctx.fill();
      ctx.strokeStyle='#d97706'; ctx.lineWidth=1.6; ctx.stroke();
    });

    ctx.fillStyle='#94a0af'; ctx.font='9px Segoe UI, Microsoft YaHei, sans-serif'; ctx.textAlign='left';
    ctx.fillText('点距 ∝ 该段位移（沿轨迹累计）',pad.l,14);
    ctx.textAlign='right';
    ctx.fillText(`等间隔 Δt = ${Number(opts.dt||0).toFixed(3)} s · 共 ${marks.length} 段${opts.tLabel?` · ${opts.tLabel}`:''}`,w-pad.r,14);
    ctx.textAlign='left';
  }

  // 框选缩放：在主图上显示拖拽矩形，并提示对应的横纵区间
  function drawSelection(canvas, rect) {
    const meta=canvas.__chartMeta; if(!meta||!rect)return;
    const ctx=canvas.getContext('2d');
    const x=Math.min(rect.x0,rect.x1), y=Math.min(rect.y0,rect.y1);
    const w=Math.abs(rect.x1-rect.x0), h=Math.abs(rect.y1-rect.y0);
    ctx.save();
    ctx.fillStyle='rgba(36,99,235,.10)';
    ctx.strokeStyle='rgba(36,99,235,.8)'; ctx.lineWidth=1.2; ctx.setLineDash([5,3]);
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
    ctx.setLineDash([]);
    const xa=meta.xmin+(x-meta.pad.l)/meta.pw*(meta.xmax-meta.xmin);
    const xb=meta.xmin+(x+w-meta.pad.l)/meta.pw*(meta.xmax-meta.xmin);
    const yb=meta.ymin+(meta.pad.t+meta.ph-(y+h))/meta.ph*(meta.ymax-meta.ymin);
    const ya=meta.ymin+(meta.pad.t+meta.ph-y)/meta.ph*(meta.ymax-meta.ymin);
    const txt=`${formatTick(xa)} ~ ${formatTick(xb)} , ${formatTick(yb)} ~ ${formatTick(ya)}`;
    ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';
    const tw=ctx.measureText(txt).width;
    const tx=Math.max(meta.pad.l,Math.min(x,meta.w-tw-18));
    const ty=y-10>meta.pad.t+14?y-10:y+h+20;
    ctx.fillStyle='rgba(15,23,42,.90)';
    roundRectPath(ctx,tx,ty-12,tw+12,17,5); ctx.fill();
    ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(txt,tx+6,ty);
    ctx.restore();
  }

  return { draw, drawXOY, hitTest, drawMini, drawCrosshair, drawStrobeStrip, drawSelection };
})();
