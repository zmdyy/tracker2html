(() => {
  const $ = id => document.getElementById(id);
  const els = {
    videoInput:$('videoInput'), video:$('video'), stage:$('stage'), overlay:$('overlay'), videoHitArea:$('videoHitArea'), emptyHint:$('emptyHint'), stageHud:$('stageHud'),
    videoStatus:$('videoStatus'), fpsBadge:$('fpsBadge'), framesBadge:$('framesBadge'), durationBadge:$('durationBadge'), seek:$('seek'), timeCurrent:$('timeCurrent'), timeEnd:$('timeEnd'),
    playBtn:$('playBtn'), stepBackBtn:$('stepBackBtn'), stepForwardBtn:$('stepForwardBtn'), resetBtn:$('resetBtn'),
    loadAiBtn:$('loadAiBtn'), detectBtn:$('detectBtn'), visionDetectBtn:$('visionDetectBtn'), modelState:$('modelState'), detections:$('detections'), selectionStatus:$('selectionStatus'), trackBtn:$('trackBtn'),
    scaleBtn:$('scaleBtn'), scaleValue:$('scaleValue'), scaleUnit:$('scaleUnit'), scaleStatus:$('scaleStatus'), invertY:$('invertY'), zeroAtStart:$('zeroAtStart'), inclineAngle:$('inclineAngle'), inclineBtn:$('inclineBtn'), coordinateStatus:$('coordinateStatus'), stageAction:$('stageAction'),
    trackingMode:$('trackingMode'), trackingModeNote:$('trackingModeNote'), sampleInterval:$('sampleInterval'), smoothRange:$('smoothRange'), smoothLabel:$('smoothLabel'), trackReadyStatus:$('trackReadyStatus'), progressWrap:$('trackingProgress'), progressBar:$('progressBar'), progressText:$('progressText'),
    mass:$('mass'), gravity:$('gravity'), zeroHeight:$('zeroHeight'),
    metricX:$('metricX'),metricY:$('metricY'),metricV:$('metricV'),metricA:$('metricA'),metricK:$('metricK'),metricU:$('metricU'),
    dataTableBody:$('dataTableBody'), tablePageSize:$('tablePageSize'), prevPageBtn:$('prevPageBtn'), nextPageBtn:$('nextPageBtn'), pageInfo:$('pageInfo'), tableRangeLabel:$('tableRangeLabel'), dataQualityBadge:$('dataQualityBadge'), sampleInfoBadge:$('sampleInfoBadge'), smoothInfoBadge:$('smoothInfoBadge'), flowRaw:$('flowRaw'), flowSample:$('flowSample'), flowSmooth:$('flowSmooth'), chartX:$('chartX'), chartY:$('chartY'), refreshChartBtn:$('refreshChartBtn'), chartCanvas:$('chartCanvas'), chartTooltip:$('chartTooltip'), chartLegendText:$('chartLegendText'), chartInterpretation:$('chartInterpretation'), trajectoryCanvas:$('trajectoryCanvas'), refreshTrajectoryBtn:$('refreshTrajectoryBtn'), trajectoryMeta:$('trajectoryMeta'), miniChartGrid:$('miniChartGrid'),
    strobeToggle:$('strobeToggle'), strobeInterval:$('strobeInterval'), strobeCanvas:$('strobeCanvas'), strobeSummary:$('strobeSummary'), strobeBadge:$('strobeBadge'), videoStrobeToggle:$('videoStrobeToggle'),
    strobeTimeMin:$('strobeTimeMin'), strobeTimeMax:$('strobeTimeMax'), strobeTimeAutoBtn:$('strobeTimeAutoBtn'),
    chartXMin:$('chartXMin'), chartXMax:$('chartXMax'), chartYMin:$('chartYMin'), chartYMax:$('chartYMax'), chartAutoRangeBtn:$('chartAutoRangeBtn'), chartXRangeLabel:$('chartXRangeLabel'), chartYRangeLabel:$('chartYRangeLabel'),
    analysisObject:$('analysisObject'),analysisObjectDetail:$('analysisObjectDetail'),analysisMotion:$('analysisMotion'),analysisMotionDetail:$('analysisMotionDetail'),analysisSummary:$('analysisSummary'),
    csvBtn:$('csvBtn'), jsonBtn:$('jsonBtn'), reportBtn:$('reportBtn'), frameCanvas:$('frameCanvas'), toast:$('toast'), trackingState:$('trackingState'), pointState:$('pointState'),
    rotationDetectBtn:$('rotationDetectBtn'), rotationStatus:$('rotationStatus'), rotationScene:$('rotationScene'), rotationMarkerToggle:$('rotationMarkerToggle'), angleUnit:$('angleUnit'), thTheta:$('thTheta'), thOmega:$('thOmega'),
  };

  const state = {
    file:null, objectUrl:null, fps:null, frameCount:null, duration:0, model:null, detections:[], target:null, colorModel:null,
    pointsPx:[], data:[], metersPerPx:null, calibrationPts:[], scalePicking:false,
    inclinePicking:false, inclineStart:null, inclineEnd:null, skipNextStageClick:false, currentTrackedPoint:null,
    trackingStop:null, tab:'data', statusTimer:null, aiLoading:false, aiLoadToken:0, tablePage:1, tablePageSize:20, rotationMode:false, pivotPx:null, rotation:null,
  };

  function toast(msg) { els.toast.textContent=msg; els.toast.classList.add('show'); clearTimeout(state.statusTimer); state.statusTimer=setTimeout(()=>els.toast.classList.remove('show'),2300); }
  function fmt(v,n=3){ return Number.isFinite(v)?Number(v).toFixed(n):'—'; }
  function setHud(){
    els.stageHud.classList.toggle('hidden',!state.file);
    const p=state.currentTrackedPoint || state.target;
    els.trackingState.textContent=state.data.length?`已建立 ${state.data.length} 个数据点`:(state.target?'已选目标':'未跟踪');
    els.pointState.textContent=p?`点：${p.x.toFixed(0)}, ${p.y.toFixed(0)}`:'点：—';
  }
  function calibHint(){ return state.metersPerPx?'':'（若尚未标定：请先在 ② 完成标尺校准，用于 r / vt / vr 实际尺寸换算）'; }
  function updateTrackButton(){
    const hasVideo=!!(state.file && els.video.videoWidth && els.video.videoHeight);
    const hasTarget=!!state.target;
    const hasScale=!!(state.metersPerPx && Number.isFinite(state.metersPerPx) && state.metersPerPx>0);
    const ready=hasVideo && hasTarget && hasScale;
    els.trackBtn.disabled=!ready;
    els.trackBtn.classList.toggle('ready',ready);
    if(!state.trackingStop) els.trackBtn.textContent='建立轨迹';
    els.trackBtn.title=ready
      ? (state.rotationMode?'已满足建立轨迹条件：目标已选择、标尺已校准，可以开始旋转测量':'已满足建立轨迹条件：目标已选择、标尺已校准，可以开始自动跟踪')
      : (state.rotationMode?'旋转测量需要：上传视频、选择运动物体，并完成 ② 标尺校准':'请先上传视频、选择目标并完成标尺校准');
    if(els.trackReadyStatus){
      if(!hasVideo) els.trackReadyStatus.textContent='准备条件：等待视频加载完成。';
      else if(!hasTarget) els.trackReadyStatus.textContent=state.rotationMode?'旋转测量准备：还没有选择运动物体。请点击固定点后，再在视频中点击摆锤/小球。':'准备条件：还没有选择目标。请在视频中点选小车/小球，或选择识别结果。';
      else if(!hasScale) els.trackReadyStatus.textContent=state.rotationMode?'旋转测量准备：目标已选择，还需在 ② 完成标尺校准（r / vt / vr 实际尺寸换算）。':'准备条件：目标已选择，还需要完成标尺校准。';
      else els.trackReadyStatus.textContent=state.rotationMode?'✓ 已就绪：目标、标尺均已设置，可以开始旋转测量。':'✓ 已就绪：目标、标尺均已设置，可以点击“建立轨迹”。';
    }
  }
  function showStageAction(text, active=true){
    els.stageAction.textContent=text;
    els.stageAction.classList.toggle('hidden',!text);
    els.stageAction.classList.toggle('active',!!active);
  }
  function clearInteraction(){
    state.scalePicking=false; state.inclinePicking=false; state.inclineStart=null;
    els.scaleBtn.classList.remove('active'); els.inclineBtn.classList.remove('active');
    showStageAction('',false);
  }
  function sourceToFrame(p){
    return {x:p.x*(els.frameCanvas.width/els.video.videoWidth), y:p.y*(els.frameCanvas.height/els.video.videoHeight)};
  }
  function frameToSource(p){
    return {x:p.x*(els.video.videoWidth/els.frameCanvas.width), y:p.y*(els.video.videoHeight/els.frameCanvas.height)};
  }
  // 视频采用 object-fit: contain。overlay 覆盖的是整个 stage，
  // 因此绘制时必须先把“原视频坐标”映射到视频实际显示区域，
  // 否则左右/上下留白会造成明显的标记偏移。
  function getVideoDisplayRect(){
    const stageRect=els.stage.getBoundingClientRect();
    const vw=els.video.videoWidth, vh=els.video.videoHeight;
    if(!vw||!vh||!stageRect.width||!stageRect.height)return null;
    const scale=Math.min(stageRect.width/vw, stageRect.height/vh);
    const w=vw*scale, h=vh*scale;
    return {
      left:(stageRect.width-w)/2, top:(stageRect.height-h)/2, width:w, height:h,
      stageLeft:stageRect.left, stageTop:stageRect.top
    };
  }
  function sourceToOverlay(p){
    const r=getVideoDisplayRect(); if(!r)return {x:0,y:0};
    return {x:r.left+p.x*(r.width/els.video.videoWidth), y:r.top+p.y*(r.height/els.video.videoHeight)};
  }

  function sizeCanvases() {
    if (!els.video.videoWidth) return;
    const w=els.video.videoWidth,h=els.video.videoHeight;
    els.overlay.width=Math.max(1,Math.round(els.stage.clientWidth));
    els.overlay.height=Math.max(1,Math.round(els.stage.clientHeight));
    // Increased cap from 720 to 1280 for better rotation tracking precision
    els.frameCanvas.width=Math.min(1280,w);
    els.frameCanvas.height=Math.max(1,Math.round(els.frameCanvas.width*h/w));
    updateHitArea();
    drawOverlay();
  }
  window.addEventListener('resize', ()=>sizeCanvases());

  function updateHitArea(){
    const r=getVideoDisplayRect();
    if(!r || !state.file){els.videoHitArea.classList.remove('active');return;}
    els.videoHitArea.style.left=`${r.left}px`;
    els.videoHitArea.style.top=`${r.top}px`;
    els.videoHitArea.style.width=`${r.width}px`;
    els.videoHitArea.style.height=`${r.height}px`;
    els.videoHitArea.classList.add('active');
  }

  function hitAreaToSource(e){
    const r=els.videoHitArea.getBoundingClientRect();
    if(!r.width||!r.height||!els.video.videoWidth)return null;
    const x=(e.clientX-r.left)*(els.video.videoWidth/r.width);
    const y=(e.clientY-r.top)*(els.video.videoHeight/r.height);
    return {x,y};
  }

  function drawOverlay() {
    const ctx=els.overlay.getContext('2d');
    ctx.clearRect(0,0,els.overlay.width,els.overlay.height);
    if(!els.video.videoWidth)return;

    if(state.detections.length){
      state.detections.forEach(d=>{
        const [fx,fy,fw,fh]=d.bbox;
        const a=sourceToOverlay(frameToSource({x:fx,y:fy}));
        const b=sourceToOverlay(frameToSource({x:fx+fw,y:fy+fh}));
        const sw=b.x-a.x, sh=b.y-a.y;
        ctx.strokeStyle=d.source==='vision'?'rgba(46,213,115,.95)':'rgba(255,209,102,.82)';
        ctx.lineWidth=Math.max(2,els.overlay.width/960);ctx.strokeRect(a.x,a.y,sw,sh);
        ctx.fillStyle='rgba(17,24,39,.80)';ctx.fillRect(a.x,a.y,Math.min(180,Math.max(90,sw)),20);
        ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`${d.class} ${(d.score*100).toFixed(0)}%`,a.x+6,a.y+14);
      });
    }

    if (state.pointsPx.length>1) {
      ctx.beginPath();
      state.pointsPx.forEach((p,i)=>{const q=sourceToOverlay(p); if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});
      ctx.strokeStyle='rgba(36,99,235,.9)';ctx.lineWidth=Math.max(3,els.overlay.width/640);ctx.stroke();
    }

    if(state.target?.clickedAt){
      const p=sourceToOverlay(state.target.clickedAt);
      ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#f59e0b';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='rgba(15,23,42,.82)';ctx.fillRect(p.x+10,p.y-12,76,22);ctx.fillStyle='#fff';ctx.font='11px sans-serif';ctx.fillText('点击位置',p.x+17,p.y+3);
    }

    const target=state.currentTrackedPoint || state.target;
    if (target) {
      const p=sourceToOverlay(target); const r=Math.max(10,els.overlay.width/90);
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.strokeStyle='#ffd166';ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x-r*1.8,p.y);ctx.lineTo(p.x+r*1.8,p.y);ctx.moveTo(p.x,p.y-r*1.8);ctx.lineTo(p.x,p.y+r*1.8);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      const labelText=target.source==='ai'?`AI：${target.label||'目标'}`:target.source==='vision'?`视觉：${target.label||'小车'}`:'目标中心';
      let chip=labelText;
      if(state.rotationMode && state.pivotPx){
        const rPx=Math.hypot(target.x-state.pivotPx.x,target.y-state.pivotPx.y);
        chip=state.currentConfidence!=null?`r=${Math.round(rPx)}px · ${Math.round(state.currentConfidence*100)}%`:`r=${Math.round(rPx)}px`;
      }
      ctx.font=`${Math.max(11,els.overlay.width/115)}px sans-serif`;
      const chipW=Math.max(84,ctx.measureText(chip).width+16);
      ctx.fillStyle='rgba(17,24,39,.84)';ctx.fillRect(p.x+r+4,p.y-r-5,chipW,22);
      ctx.fillStyle='#fff';ctx.fillText(chip,p.x+r+10,p.y+3);
      if(state.rotationMode && state.target?.w && state.target.h){
        const ballR=Math.max(6,(Math.min(state.target.w,state.target.h)/2)*(els.overlay.width/els.video.videoWidth));
        ctx.beginPath();ctx.arc(p.x,p.y,ballR,0,Math.PI*2);ctx.strokeStyle='rgba(96,211,148,.9)';ctx.lineWidth=1.5;ctx.stroke();
      }
    }

    if (state.calibrationPts.length) {
      const [a,b]=state.calibrationPts;
      [a,b].forEach((p,i)=>{ if(!p)return; const q=sourceToOverlay(p); const r=Math.max(10,els.overlay.width/105);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fillStyle=i===0?'#ffd166':'#60d394';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#111827';ctx.font='700 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===0?'1':'2',q.x,q.y);ctx.textAlign='start';ctx.textBaseline='alphabetic';});
      if(b){
        const oa=sourceToOverlay(a), ob=sourceToOverlay(b);
        ctx.beginPath();ctx.moveTo(oa.x,oa.y);ctx.lineTo(ob.x,ob.y);ctx.strokeStyle='#60d394';ctx.lineWidth=3;ctx.stroke();
        const d=Math.hypot(b.x-a.x,b.y-a.y);ctx.fillStyle='rgba(15,23,42,.90)';ctx.fillRect((oa.x+ob.x)/2-62,(oa.y+ob.y)/2-12,124,24);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`${d.toFixed(1)} px`,(oa.x+ob.x)/2-50,(oa.y+ob.y)/2+4);
      }
    }

    if(state.inclineStart && state.inclineEnd){
      const a=sourceToOverlay(state.inclineStart),b=sourceToOverlay(state.inclineEnd);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#8ecae6';ctx.lineWidth=4;ctx.stroke();
      [a,b].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle='#8ecae6';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});
      const raw=Math.abs(Math.atan2(state.inclineEnd.y-state.inclineStart.y,state.inclineEnd.x-state.inclineStart.x)*180/Math.PI);const angle=Math.min(89.9,raw>90?180-raw:raw);
      ctx.fillStyle='rgba(15,23,42,.92)';ctx.fillRect((a.x+b.x)/2-70,(a.y+b.y)/2-34,140,24);ctx.fillStyle='#fff';ctx.font='700 12px sans-serif';ctx.fillText(`斜面角 ${angle.toFixed(1)}°`,(a.x+b.x)/2-59,(a.y+b.y)/2-18);
    }

    if(state.rotationMode && state.pivotPx){
      const po=sourceToOverlay(state.pivotPx);
      ctx.beginPath();ctx.arc(po.x,po.y,Math.max(9,els.overlay.width/115),0,Math.PI*2);
      ctx.strokeStyle='#f472b6';ctx.lineWidth=3;ctx.fillStyle='rgba(244,114,182,.25)';ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(po.x,po.y,Math.max(3,els.overlay.width/300),0,Math.PI*2);ctx.fillStyle='#e11d48';ctx.fill();
      ctx.fillStyle='rgba(17,24,39,.84)';ctx.fillRect(po.x+14,po.y-8,Math.max(60,els.overlay.width/12),16);
      ctx.fillStyle='#fff';ctx.font='11px sans-serif';ctx.fillText('固定点',po.x+18,po.y+2);
      if(els.rotationMarkerToggle && els.rotationMarkerToggle.checked && state.currentTrackedPoint){
        const to=sourceToOverlay(state.currentTrackedPoint);
        ctx.beginPath();ctx.moveTo(po.x,po.y);ctx.lineTo(to.x,to.y);
        ctx.setLineDash([6,4]);ctx.strokeStyle='rgba(244,114,182,.9)';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
      }
    }
    drawStrobeOverlay(ctx);
  }

  // ===== 把①的等时间间隔打点投影到视频画面上 =====
  // 橙点 = 相同时刻小车在视频中的位置；虚线弦 = 相邻两次打点之间的位移（标注 Δs）
  const rectFits=(drawn,r)=>{
    for(const o of drawn){
      if(Math.abs((o.x+o.w/2)-(r.x+r.w/2))<((o.w+r.w)/2+3)&&Math.abs((o.y+o.h/2)-(r.y+r.h/2))<((o.h+r.h)/2+2))return false;
    }
    return true;
  };
  function drawStrobeOverlay(ctx){
    if(!els.videoStrobeToggle||!els.videoStrobeToggle.checked)return;
    if(state.data.length<2||!state.pointsPx.length)return;
    const win=timeWindow();
    const {dt,marks}=buildStrobeMarks(pickStrobeDt(win),win);
    const list=marks.filter(m=>m.px).map(m=>({ds:m.ds,o:sourceToOverlay(m.px)}));
    if(list.length<2)return;
    const W=els.overlay.width, H=els.overlay.height;
    const lw=Math.max(1.5,els.overlay.width/880);
    const rDot=Math.max(5.5,Math.min(9,els.overlay.width/150));
    ctx.save();
    ctx.setLineDash([]);
    // 1) 虚线弦（位移段）+ 每段位移标注
    const drawn=[];
    for(let i=1;i<list.length;i++){
      const a=list[i-1].o,b=list[i].o;
      const len=Math.hypot(b.x-a.x,b.y-a.y);
      if(len<2)continue;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.setLineDash([7,5]);ctx.strokeStyle='rgba(249,115,22,.95)';ctx.lineWidth=lw+0.8;ctx.stroke();
      ctx.setLineDash([]);
      const txt=Number.isFinite(list[i].ds)?`${list[i].ds.toFixed(3)} m`:'';
      if(!txt||len<40)continue;
      ctx.font='700 11px sans-serif';
      const w=ctx.measureText(txt).width+10,h=16;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      const nx=-(b.y-a.y)/len, ny=(b.x-a.x)/len;   // 弦的法向
      let placed=null;
      for(const d of [15,-15,30,-30,45,-45]){
        const r={x:mx+nx*d-w/2,y:my+ny*d-h/2,w,h};
        if(r.x<2||r.y<2||r.x+w>W-2||r.y+h>H-2)continue;
        if(rectFits(drawn,r)){placed=r;break;}
      }
      if(placed){
        drawn.push(placed);
        ctx.fillStyle='rgba(15,23,42,.86)';ctx.fillRect(placed.x,placed.y,w,h);
        ctx.fillStyle='#ffd7a8';ctx.font='700 11px sans-serif';
        ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(txt,placed.x+5,placed.y+h/2+0.5);
      }
    }
    // 2) 打点（橙点 + 序号）
    const numbered=list.length<=16;
    list.forEach((m,i)=>{
      const p=m.o;
      ctx.beginPath();ctx.arc(p.x,p.y,rDot,0,Math.PI*2);
      ctx.fillStyle=i===0?'#22c55e':'#f97316';ctx.fill();
      ctx.lineWidth=Math.max(1.6,rDot*0.32);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.stroke();
      if(numbered){
        ctx.fillStyle='#fff';ctx.font=`700 ${Math.round(rDot*1.2)}px sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(String(i+1),p.x,p.y+0.5);
      }
    });
    // 3) 参数标签（贴在首个打点旁）
    const first=list[0].o;
    const tag=`等时间打点 Δt = ${dt.toFixed(3)} s · ${list.length} 点`;
    ctx.font='700 11px sans-serif';
    const tw=ctx.measureText(tag).width+12, th=20;
    let tx=first.x+10, ty=first.y-rDot-th-6;
    if(ty<4)ty=first.y+rDot+6;
    if(tx+tw>W-4)tx=Math.max(4,W-4-tw);
    if(ty+th>H-4)ty=Math.max(4,H-4-th);
    ctx.fillStyle='rgba(249,115,22,.94)';ctx.fillRect(tx,ty,tw,th);
    ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(tag,tx+6,ty+th/2+0.5);
    ctx.restore();
  }

  async function loadVideo(file){
    if(state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file=file; state.objectUrl=URL.createObjectURL(file); state.fps=null; state.frameCount=null; state.duration=0; state.target=null; state.currentTrackedPoint=null; state.colorModel=null; state.pointsPx=[];state.data=[];state.detections=[];state.rotationMode=false;state.pivotPx=null;state.rotation=null;state.metersPerPx=null; state.rotationSampleR=null; state.calibrationPts=[]; state.inclineStart=null;state.inclineEnd=null; clearInteraction();
    els.video.src=state.objectUrl; els.video.load(); updateHitArea(); els.stage.classList.remove('empty'); els.emptyHint.classList.add('hidden'); els.videoStatus.textContent=`正在读取：${file.name}`; updateTrackButton(); els.detectBtn.disabled=!state.model; els.visionDetectBtn.disabled=false; els.rotationDetectBtn.disabled=false; els.rotationDetectBtn.classList.remove('active'); els.selectionStatus.textContent='当前未选择目标。可直接点击物体中心，或用“视觉识别目标”/“旋转测量”。'; clearAnalysis();
    try { const parsed=await MP4Parser.getFps(file); state.fps=parsed.fps; state.duration=parsed.duration; state.frameCount=parsed.samples; } catch { /* fallback */ }
    els.video.addEventListener('loadedmetadata', onMetadata, {once:true});
  }
  function onMetadata(){
    state.duration=els.video.duration || state.duration || 0;
    if(!state.frameCount && state.fps && state.duration) state.frameCount=Math.round(state.fps*state.duration);
    sizeCanvases(); updateVideoUi(); updateTrackButton(); toast('视频已加载');
  }
  function updateVideoUi(){
    els.fpsBadge.textContent=state.fps?`${state.fps.toFixed(2)} fps`:'浏览器估计';
    els.framesBadge.textContent=state.frameCount?state.frameCount.toLocaleString():'—';
    els.durationBadge.textContent=fmt(state.duration,2)+' s';
    els.timeEnd.textContent=fmt(state.duration,3); els.seek.max=state.duration||0; els.seek.value=els.video.currentTime||0; els.timeCurrent.textContent=fmt(els.video.currentTime,3);
  }
  function setTime(t){ const dur=state.duration||els.video.duration||0; els.video.currentTime=Math.max(0,Math.min(dur,t)); }
  function frameStep(delta){
    const fps=state.fps||30; setTime(els.video.currentTime+delta/fps);
  }

  els.videoInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadVideo(f);});
  els.playBtn.addEventListener('click',()=>{if(els.video.paused)els.video.play();else els.video.pause();});
  els.video.addEventListener('play',()=>els.playBtn.textContent='❚❚'); els.video.addEventListener('pause',()=>els.playBtn.textContent='▶');
  els.stepBackBtn.addEventListener('click',()=>frameStep(-1)); els.stepForwardBtn.addEventListener('click',()=>frameStep(1));
  els.seek.addEventListener('input',e=>setTime(Number(e.target.value)));
  els.video.addEventListener('timeupdate',()=>{els.seek.value=els.video.currentTime;els.timeCurrent.textContent=fmt(els.video.currentTime,3);});
  els.video.addEventListener('loadeddata',sizeCanvases);

  let inclineDragMoved=false;
  els.videoHitArea.addEventListener('pointerdown',e=>{
    if(!state.file)return;
    const p=hitAreaToSource(e); if(!p)return;
    if(state.inclinePicking){
      state.inclineStart=p; state.inclineEnd=p; inclineDragMoved=false; els.videoHitArea.setPointerCapture?.(e.pointerId); drawOverlay();
    }
  });
  els.videoHitArea.addEventListener('pointermove',e=>{
    if(!state.inclinePicking||!state.inclineStart)return;
    const p=hitAreaToSource(e); if(!p)return;
    state.inclineEnd=p; inclineDragMoved=true; drawOverlay();
  });
  els.videoHitArea.addEventListener('pointerup',e=>{
    if(!state.inclinePicking||!state.inclineStart)return;
    const p=hitAreaToSource(e); if(p)state.inclineEnd=p;
    const a=state.inclineStart,b=state.inclineEnd;
    if(a&&b&&Math.hypot(b.x-a.x,b.y-a.y)>10){
      const raw=Math.abs(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
      const angle=Math.min(89.9,raw>90?180-raw:raw);
      els.inclineAngle.value=angle.toFixed(1);
      els.coordinateStatus.textContent=`已自动测量：斜面角 ${angle.toFixed(1)}°。线段两端均已标记，可重新测量。`;
      toast(`斜面角已测量：${angle.toFixed(1)}°`);
    } else { toast('斜面线太短，请重新拉一条较长的线'); }
    state.inclinePicking=false; els.inclineBtn.classList.remove('active'); showStageAction('斜面角已测量',false); drawOverlay();
  });
  els.videoHitArea.addEventListener('pointercancel',()=>{if(state.inclinePicking){state.inclinePicking=false;els.inclineBtn.classList.remove('active');showStageAction('斜面测量已取消',false);drawOverlay();}});

  els.videoHitArea.addEventListener('click',e=>{
    if(state.inclinePicking)return;
    const p=hitAreaToSource(e); if(!p||!state.file)return;
    if(state.scalePicking){
      if(state.calibrationPts.length>=2)state.calibrationPts=[];
      state.calibrationPts.push(p); drawOverlay();
      if(state.calibrationPts.length===1){els.scaleStatus.textContent='已选第 1 个端点（黄色“1”）。现在点击第 2 个端点。';showStageAction('已选标尺第 1 点，请点击第 2 点');toast('标尺第 1 点已选');}
      if(state.calibrationPts.length===2) finishCalibration();
      return;
    }
    if(state.rotationMode && !state.pivotPx){
      state.pivotPx={...p};
      els.rotationStatus.textContent=`固定点已记录：${p.x.toFixed(0)}, ${p.y.toFixed(0)} px。② 现在点击运动物体（摆锤/小球）。${calibHint()}`;
      showStageAction('固定点已记录，② 请点击运动物体',false); drawOverlay(); setHud(); toast('固定点已记录');
      return;
    }
    const clickedAt={...p};
    let targetPoint={...p}, targetSize={w:32,h:32}, refined=false;
    const rot=state.rotationMode;
    try{
      const ctx=els.frameCanvas.getContext('2d');
      const img=TrackingEngine.getFrame(ctx,els.video);
      const fp=sourceToFrame(p);
      let hit=TrackingEngine.refineColoredSeed(img,fp.x,fp.y,rot?{maxRadius:60,minArea:20,step:1,radius:3,centerMode:'bbox'}:{maxRadius:90});
      if(!hit && rot) hit=TrackingEngine.refineByTemplate(ctx,fp.x,fp.y);
      if(hit){
        if(rot){
          state.rotationSampleR=Math.max(3,Math.min(10,Math.min(hit.w,hit.h)/2));
          state.colorModel=TrackingEngine.sampleColorModel(img,fp.x,fp.y,state.rotationSampleR);
          targetPoint=frameToSource({x:hit.cx??hit.x,y:hit.cy??hit.y});
        } else {
          state.colorModel=TrackingEngine.sampleColorModel(img,fp.x,fp.y);
          targetPoint=frameToSource({x:hit.wcx,y:hit.wcy});
        }
        targetSize={w:hit.w*(els.video.videoWidth/els.frameCanvas.width),h:hit.h*(els.video.videoHeight/els.frameCanvas.height)};
        refined=true;
      } else {
        state.colorModel=TrackingEngine.sampleColorModel(img,fp.x,fp.y);
        state.rotationSampleR=null;
      }
    }catch(err){ console.debug('颜色预定位失败',err); }
    state.target={...targetPoint,...targetSize,source:refined?'vision':'manual',label:refined?'视觉目标':'目标',clickedAt};
    state.currentTrackedPoint=targetPoint; state.data=[];state.pointsPx=[];updateTrackButton();
    els.selectionStatus.textContent=rot
      ? (refined
          ? `目标已锁定：中心 ${targetPoint.x.toFixed(0)}, ${targetPoint.y.toFixed(0)} px，半径约 ${Math.round(Math.hypot(targetPoint.x-state.pivotPx.x,targetPoint.y-state.pivotPx.y))} px（颜色/模板识别）。黄色十字=目标中心。`
          : `未找到合适目标：点击位置 ${clickedAt.x.toFixed(0)}, ${clickedAt.y.toFixed(0)} px。建议：①放大视频 ②重新点击小球中心 ③选择清晰帧。`)
      : (refined
          ? `已记录点击位置：${clickedAt.x.toFixed(0)}, ${clickedAt.y.toFixed(0)} px；已学习目标颜色并吸附到中心：${targetPoint.x.toFixed(0)}, ${targetPoint.y.toFixed(0)} px。白点=点击位置，黄色十字=目标中心。`
          : `已记录点击位置：${clickedAt.x.toFixed(0)}, ${clickedAt.y.toFixed(0)} px。白点=点击位置，黄色十字=目标中心。`);
    showStageAction('已选目标中心',false); setHud();drawOverlay();toast('已选定目标，点击位置与目标标记均已显示');
  });

  async function withTimeout(promise, ms, message){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);});
    try{return await Promise.race([promise,timeout]);}finally{clearTimeout(timer);}
  }
  async function ensureAI(){
    if(state.model)return state.model;
    if(state.aiLoading)throw new Error('AI正在加载，请稍候');
    if(!window.tf){els.modelState.textContent='TensorFlow.js未加载';els.modelState.className='status-pill danger';throw new Error('TensorFlow.js 脚本没有加载，请检查网络或 CDN。');}
    if(!window.cocoSsd){els.modelState.textContent='AI组件未加载';els.modelState.className='status-pill danger';throw new Error('COCO-SSD 脚本没有加载，请检查网络或 CDN。');}
    state.aiLoading=true; const token=++state.aiLoadToken; els.loadAiBtn.disabled=true; els.detectBtn.disabled=true;
    els.modelState.textContent='准备 AI 引擎…';els.modelState.className='status-pill warn';
    showStageAction('正在加载 AI（首次加载可能需要十几秒）',true);
    try{
      await withTimeout(window.tf.ready(),12000,'TensorFlow.js 初始化超时');
      els.modelState.textContent='正在下载目标识别模型…（网络较慢时可重试）';
      const model=await withTimeout(cocoSsd.load({base:'lite_mobilenet_v2'}),18000,'AI模型下载超时');
      if(token!==state.aiLoadToken)throw new Error('AI加载任务已失效');
      state.model=model; els.modelState.textContent='AI已就绪';els.modelState.className='status-pill good'; els.loadAiBtn.textContent='AI已加载'; els.detectBtn.disabled=!state.file; showStageAction('',false); toast('AI目标识别模型已就绪');
      return model;
    }catch(e){
      console.error(e); state.model=null; els.loadAiBtn.textContent='重新加载 AI'; els.modelState.textContent=`AI加载失败：${e.message||'未知错误'}`;els.modelState.className='status-pill danger';
      showStageAction('AI加载失败：可重试，或直接手动点选目标',false); toast(`AI未加载成功：${e.message||'请检查网络'}`); throw e;
    }finally{
      state.aiLoading=false; els.loadAiBtn.disabled=false;
    }
  }
  els.loadAiBtn.addEventListener('click',async()=>{try{await ensureAI();}catch(e){console.error(e);}});
  els.detectBtn.addEventListener('click',async()=>{if(!state.file)return toast('请先上传视频');try{const m=await ensureAI();const ctx=els.frameCanvas.getContext('2d');TrackingEngine.getFrame(ctx,els.video); const dets=await withTimeout(m.detect(els.frameCanvas,20),12000,'目标识别超时'); state.detections=dets.sort((a,b)=>b.score-a.score).filter(d=>d.score>.35);renderDetections();drawDetectionBoxes(state.detections);toast(`检测到 ${state.detections.length} 个候选目标`);}catch(e){console.error(e);toast(`目标识别失败：${e.message||'请手动点选'}`);}});
  els.visionDetectBtn.addEventListener('click',async()=>{
    if(!state.file)return toast('请先上传视频');
    if(!state.colorModel){els.selectionStatus.textContent='请先在视频中点击目标中心，程序会学习该目标的颜色，再执行视觉识别。';return toast('请先在视频中点击目标中心');}
    try{
      const ctx=els.frameCanvas.getContext('2d');
      const img=TrackingEngine.getFrame(ctx,els.video);
      const candidates=TrackingEngine.detectColorCandidates(img,{minArea:120,model:state.colorModel}).slice(0,5);
      state.detections=candidates.map((c,i)=>({bbox:[c.x,c.y,c.w,c.h],class:'视觉目标',score:Math.min(.99,.72+.20*Math.min(1,c.area/7000)),source:'vision',area:c.area,centroid:{x:c.wcx,y:c.wcy}}));
      renderDetections();
      if(state.detections.length){
        const d=state.detections[0], c=TrackingEngine.centerFromDetection(d), cs=frameToSource(c);
        state.target={...cs,w:c.w,h:c.h,source:'vision',label:'视觉目标'};state.currentTrackedPoint=cs;state.pointsPx=[];state.data=[];updateTrackButton();
        state.target.clickedAt=null;
        els.selectionStatus.textContent=`已按学习到的目标颜色识别：中心 ${cs.x.toFixed(0)}, ${cs.y.toFixed(0)} px。此方式不依赖通用 AI。`;
        showStageAction('已识别目标，可建立轨迹',false);setHud();drawOverlay();toast('已按目标颜色完成视觉识别');
      } else { els.selectionStatus.textContent='未找到与目标颜色相近的区域，请重新点击目标中心后再试。';toast('未找到相近颜色的目标，请重新点选'); }
    }catch(e){console.error(e);toast(`视觉识别失败：${e.message||'请手动点选'}`);}
  });

  const ROT_CHART_KEYS=['theta','omega','r','vt','vr'];
  els.rotationDetectBtn.addEventListener('click',()=>{
    if(!state.file)return toast('请先上传视频');
    state.rotationMode=!state.rotationMode;
    if(state.rotationMode){
      state.pivotPx=null; state.rotation=null;
      els.rotationDetectBtn.classList.add('active');
      if(els.trackingMode) els.trackingMode.value='pendulum';
      els.rotationStatus.textContent='旋转测量模式已开启：① 点击固定点（悬挂点/圆心），随后②再点击运动物体（摆锤/小球）。'+calibHint();
      showStageAction('① 请点击固定点（悬挂点/圆心）',true);
    } else {
      state.pivotPx=null; state.rotation=null;
      els.rotationDetectBtn.classList.remove('active');
      els.rotationStatus.textContent='旋转测量已退出，固定点已清空。';
      showStageAction('',false);
      if(ROT_CHART_KEYS.includes(els.chartY.value)){els.chartY.value='x';refreshChart();}
      if(state.data.length)finalizeData();
    }
    setHud();drawOverlay();buildMiniCards();refreshMiniCharts();
  });


  function renderDetections(){
    if(!state.detections.length){els.detections.innerHTML='未检测到置信度足够高的目标';return;}
    els.detections.classList.remove('empty-detection');els.detections.innerHTML='';
    state.detections.forEach((d,i)=>{const c=TrackingEngine.centerFromDetection(d);const cs=frameToSource(c);const row=document.createElement('button');row.className='detection';row.innerHTML=`<span class="detection-left"><span class="detection-dot"></span><span class="detection-name">${d.class}</span></span><span class="detection-score">${(d.score*100).toFixed(0)}%</span>`;row.addEventListener('click',()=>{state.target={...cs,w:c.w,h:c.h,source:d.source==='vision'?'vision':'ai',label:d.class,clickedAt:null};state.currentTrackedPoint=cs;state.pointsPx=[];state.data=[];updateTrackButton();els.selectionStatus.textContent=d.source==='vision'?`已选择视觉识别目标“${d.class}”。视频上的黄色十字就是当前目标。`:`已选择 AI 目标“${d.class}”。视频上的黄色十字就是当前目标，可继续点击其他目标更换。`;showStageAction(`已选择：${d.class}`,false);setHud();drawOverlay();toast(`已选择：${d.class}，黄色标记已显示`);});els.detections.appendChild(row);});
  }
  function drawDetectionBoxes(){ drawOverlay(); }

  els.scaleBtn.addEventListener('click',()=>{
    if(!state.file)return toast('请先上传视频');
    state.scalePicking=true;state.inclinePicking=false;state.calibrationPts=[];state.skipNextStageClick=false;els.scaleBtn.classList.add('active');els.inclineBtn.classList.remove('active');
    els.scaleStatus.textContent='等待第 1 个端点：点击标尺一端；点到后会出现“1”圆点。';showStageAction('标尺校准：点击第 1 个端点',true);drawOverlay();toast('请点击标尺第 1 个端点');
  });
  function finishCalibration(){
    state.scalePicking=false; els.scaleBtn.classList.remove('active');showStageAction('标尺两点已选，校准完成',false);
    const [a,b]=state.calibrationPts; const px=Math.hypot(b.x-a.x,b.y-a.y); const val=Number(els.scaleValue.value); const unit=els.scaleUnit.value; const meters=val*(unit==='m'?1:unit==='cm'?0.01:0.001);
    if(!px||!meters){els.scaleStatus.textContent='校准失败，请重新设置';toast('尺度校准失败，请重新点选');return;}
    state.metersPerPx=meters/px;updateTrackButton();els.scaleStatus.textContent=`已选端点 1、2：${px.toFixed(1)} px = ${meters} m；1 px = ${(state.metersPerPx*1000).toFixed(3)} mm`;toast('尺度校准完成，绿色连线已显示');drawOverlay();
  }
  els.inclineBtn.addEventListener('click',()=>{
    if(!state.file)return toast('请先上传视频');
    state.inclinePicking=true;state.inclineStart=null;state.inclineEnd=null;state.scalePicking=false;state.skipNextStageClick=false;els.inclineBtn.classList.add('active');els.scaleBtn.classList.remove('active');
    els.coordinateStatus.textContent='测量模式：按住鼠标在视频中沿斜面方向拖一条线；松开后自动计算角度。';showStageAction('斜面测角：按住鼠标沿斜面拖线',true);drawOverlay();toast('请沿斜面方向拖线测角');
  });

  els.inclineAngle.addEventListener('change',()=>{const a=Number(els.inclineAngle.value)||0;els.coordinateStatus.textContent=`已手动设置：斜面角 ${a.toFixed(1)}°；也可点击“在视频上测量斜面角”自动测量`;});

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(state.scalePicking||state.inclinePicking){clearInteraction();els.scaleStatus.textContent=state.calibrationPts.length===1?'已保留第 1 个标记；重新开始可覆盖。':'当前测量已取消。';els.coordinateStatus.textContent='当前测量已取消，可重新选择测量方式。';drawOverlay();toast('当前测量操作已取消');}
  });

  els.smoothRange.addEventListener('input',()=>els.smoothLabel.textContent=({0:'关闭',1:'轻度',2:'中等',3:'较强',4:'强'})[els.smoothRange.value]);
  els.trackBtn.addEventListener('click',startTracking);

  async function startTracking(){
    if(!state.target){updateTrackButton();return toast('请先选定目标');}
    if(!state.metersPerPx){updateTrackButton();return toast(state.rotationMode?'旋转测量需要先完成标尺校准（② 标尺校准），用于 r / vt / vr 实际尺寸换算':'请先完成标尺校准');}
    if(state.rotationMode && !state.pivotPx){updateTrackButton();return toast('旋转测量需要先点击固定点（悬挂点/圆心）');}
    updateTrackButton();
    if(state.trackingStop){state.trackingStop();state.trackingStop=null;return;}
    // Start from current time, but reset prior results.
    state.pointsPx=[]; state.data=[]; els.progressWrap.classList.remove('hidden');els.progressBar.style.width='0%';els.progressText.textContent='正在建立轨迹…';els.trackBtn.textContent='停止追踪';
    const ctx=els.frameCanvas.getContext('2d'); TrackingEngine.getFrame(ctx,els.video);
    const startFramePoint={...sourceToFrame(state.target),w:state.target.w*(els.frameCanvas.width/els.video.videoWidth),h:state.target.h*(els.frameCanvas.height/els.video.videoHeight)};
    state.currentTrackedPoint={...state.target};
    // 从当前视频位置开始跟踪，避免“中段点选、却从第 0 帧取模板”的错位。
    const startFrame=Math.max(0,Math.round((els.video.currentTime||0)*(state.fps||30)));
    let sampleEvery=Math.max(1,Number(els.sampleInterval.value)||1), sampleIndex=0;
    try {
      const pivotFrame=sourceToFrame(state.pivotPx||{x:0,y:0});
      const targetFrame=sourceToFrame(state.target);
      const pivotRadius=Math.hypot(targetFrame.x-pivotFrame.x,targetFrame.y-pivotFrame.y);
      state.trackingStop=await TrackingEngine.trackPlayback({
        video:els.video,frameCtx:ctx,overlayCtx:els.overlay.getContext('2d'),startPoint:startFramePoint,startFrame,trackerMode:els.trackingMode.value,fps:state.fps||30,totalFrames:state.frameCount||Math.round((state.duration||0)*(state.fps||30)),
        centerMode:state.rotationMode?'bbox':'weighted', sampleRadius:state.rotationSampleR,
        pivot:state.rotationMode&&state.pivotPx?pivotFrame:null, pivotRadius:state.rotationMode&&state.pivotPx?pivotRadius:null,
        onPoint:p=>{
          const frameNo=Number.isFinite(p.frame)?p.frame:(Number.isFinite(p.t)?Math.round(p.t*(state.fps||30)):sampleIndex);
          if((frameNo-startFrame) % sampleEvery!==0)return;
          sampleIndex++;
          const q={...frameToSource(p),t:Number.isFinite(p.t)?p.t:frameNo/(state.fps||30),frame:frameNo,confidence:p.confidence};
          state.pointsPx.push(q); state.currentTrackedPoint=q; state.currentConfidence=p.confidence;
          els.pointState.textContent=`第 ${frameNo+1} 帧 · 点：${q.x.toFixed(0)}, ${q.y.toFixed(0)}`;
          els.selectionStatus.textContent=`正在跟踪目标：第 ${frameNo+1} 帧，时间 ${q.t.toFixed(3)} s；${p.confidence>=0.6?'跟踪稳定':'置信度偏低'}`;
          drawOverlay();
        },
        onProgress:(ratio,count)=>{
          els.progressBar.style.width=`${Math.round(ratio*100)}%`;
          const total=state.frameCount||Math.round((state.duration||0)*(state.fps||30));
          const span=Math.max(1,total-startFrame);
          els.progressText.textContent=total?`已采集 ${count} / ${span} 帧${sampleEvery>1?` · 每 ${sampleEvery} 帧取 1 点`:''} · ${Math.round(ratio*100)}%`:`已采集 ${count} 帧 · ${Math.round(ratio*100)}%`;
        },
        onModeInfo:msg=>{ if(els.selectionStatus) els.selectionStatus.textContent=msg; if(els.trackingModeNote) els.trackingModeNote.textContent=msg+'；分析过程中不会用屏幕刷新次数替代视频帧。'; },
        onFinish:()=>{state.trackingStop=null;updateTrackButton();finalizeData();els.progressText.textContent=`完成：${state.pointsPx.length} 个采样点（对应视频帧，不再按屏幕刷新次数计数）`;els.selectionStatus.textContent=`自动轨迹已完成：共 ${state.pointsPx.length} 个采样点。视频上蓝色轨迹线表示跟踪结果；CSV 将包含帧号与时间。`;showStageAction('轨迹建立完成',false);toast('轨迹建立完成');}
      });
    } catch(e){console.error(e);state.trackingStop=null;updateTrackButton();els.progressWrap.classList.add('hidden');els.selectionStatus.textContent=`自动跟踪失败：${e.message||'目标移动过快或纹理不足'}。可以换一个起始帧重新点选目标。`;showStageAction('跟踪失败：请重新点选目标',false);toast(`自动跟踪失败：${e.message||'请重试'}`);}
  }

  function finalizeData(){
    const cfg={metersPerPx:state.metersPerPx,invertY:els.invertY.checked,zeroAtStart:els.zeroAtStart.checked,inclineAngle:Number(els.inclineAngle.value)||0,mass:Number(els.mass.value)||0,gravity:Number(els.gravity.value)||9.8,zeroHeight:Number(els.zeroHeight.value)||0,smooth:Number(els.smoothRange.value)||0};
    state.data=PhysicsEngine.analyze(state.pointsPx,cfg);
    state.rotation=null;
    if(state.rotationMode && state.pivotPx && state.pointsPx.length===state.data.length){
      const rot=RotationEngine.compute(state.pointsPx,state.pivotPx,{metersPerPx:state.metersPerPx,fps:state.fps||30,smooth:cfg.smooth,scene:els.rotationScene?els.rotationScene.value:'circle'});
      state.rotation=rot;
      state.data=state.data.map(function(d,i){
        const row={...d,...rot.rows[i]};
        if(Number.isFinite(row.v)&&Number.isFinite(row.vt)&&Number.isFinite(row.vr)&&row.thetaConfidence===1){
          const r2=row.vt*row.vt+row.vr*row.vr, v2=row.v*row.v;
          if(v2>1e-9 && Math.abs(r2-v2)/v2>0.5) row.thetaConfidence=0;
        }
        return row;
      });
    }
    updateMetrics();renderTable();updateAnalysis();drawOverlay();setHud();refreshTrajectory();refreshMiniCharts();if(state.tab==='charts')refreshChart();
  }
  function updateMetrics(){
    if(!state.data.length)return;
    const first=state.data[0], last=state.data[state.data.length-1];
    const maxV=Math.max(...state.data.map(d=>Number.isFinite(d.v)?d.v:0));
    const maxA=Math.max(...state.data.map(d=>Number.isFinite(d.a)?Math.abs(d.a):0));
    const maxEk=Math.max(...state.data.map(d=>Number.isFinite(d.Ek)?d.Ek:0));
    const dx=last.x-first.x, dEm=last.Em-first.Em;
    els.metricX.textContent=fmt(dx);
    els.metricY.textContent=fmt(last.y-first.y);
    els.metricV.textContent=fmt(maxV);
    els.metricA.textContent=fmt(maxA);
    els.metricK.textContent=fmt(maxEk);
    els.metricU.textContent=fmt(dEm);
    const interval=Math.max(1,Number(els.sampleInterval.value)||1), raw=state.frameCount||state.data.length*interval;
    const smoothMap={0:'关闭',1:'轻度',2:'中等',3:'较强',4:'强'};
    const smooth=smoothMap[Number(els.smoothRange.value)||0];
    const confidence=state.data.map(d=>d.confidence).filter(v=>Number.isFinite(v));
    const avgConf=confidence.length?confidence.reduce((a,b)=>a+b,0)/confidence.length:null;
    els.dataQualityBadge.textContent=avgConf==null?'数据已计算':(avgConf>=.8?'跟踪质量：好':avgConf>=.6?'跟踪质量：一般':'跟踪质量：需检查');
    els.dataQualityBadge.className=`quality-badge ${avgConf==null?'neutral':avgConf>=.8?'good':avgConf>=.6?'warn':'danger'}`;
    els.sampleInfoBadge.textContent=`采样：${state.data.length} / ${raw} 帧`;
    els.smoothInfoBadge.textContent=`平滑：${smooth}`;
    els.flowRaw.textContent=`${state.frameCount||'—'} 帧 · ${(state.duration||0).toFixed(2)} s`;
    els.flowSample.textContent=`${state.data.length} 点 · 每${interval}帧`;
    els.flowSmooth.textContent=smooth;
    state.tablePage=1;
  }
  function renderTable(){
    const unit=els.angleUnit?els.angleUnit.value:'deg';
    if(els.thTheta)els.thTheta.textContent=unit==='rad'?'θ / rad':'θ / °';
    if(els.thOmega)els.thOmega.textContent=unit==='rad'?'ω / rad/s':'ω / °/s';
    if(!state.data.length){els.dataTableBody.innerHTML='<tr><td colspan="15" class="table-empty">尚未建立轨迹数据</td></tr>';els.pageInfo.textContent='第 0 / 0 页';return;}
    const size=Math.max(1,Number(els.tablePageSize?.value||state.tablePageSize||20));
    state.tablePageSize=size;
    const totalPages=Math.max(1,Math.ceil(state.data.length/size));
    state.tablePage=Math.min(Math.max(1,state.tablePage),totalPages);
    const start=(state.tablePage-1)*size, end=Math.min(start+size,state.data.length);
    const shown=state.data.slice(start,end);
    els.dataTableBody.innerHTML=shown.map((d,idx)=>{
      const absolute=start+idx+1;
      const frame=Number.isFinite(d.frame)?d.frame:Math.round(d.t*(state.fps||30));
      return `<tr data-frame="${frame}" data-index="${absolute-1}"><td>${absolute}</td><td>${frame}</td><td>${fmt(d.t,3)}</td><td>${fmt(d.x,4)}</td><td>${fmt(d.y,4)}</td><td>${fmt(d.s,4)}</td><td>${fmt(d.v,4)}</td><td>${fmt(d.a,4)}</td><td>${fmt(d.Ek,4)}</td><td>${fmt(d.Em,4)}</td><td>${(unit==='rad'?fmt(d.thetaRad,4):fmt(d.thetaDeg,1))}</td><td>${(unit==='rad'?fmt(d.omega,3):fmt(Number.isFinite(d.omega)?d.omega*180/Math.PI:NaN,3))}</td><td>${fmt(d.r,4)}</td><td>${fmt(d.vt,4)}</td><td>${fmt(d.vr,4)}</td></tr>`;
    }).join('');
    els.pageInfo.textContent=`第 ${state.tablePage} / ${totalPages} 页`;
    els.prevPageBtn.disabled=state.tablePage<=1;
    els.nextPageBtn.disabled=state.tablePage>=totalPages;
    els.tableRangeLabel.textContent=`显示第 ${start+1}–${end} 条，共 ${state.data.length} 条；点击行可定位视频`;
  }
  function updateAnalysis(){
    const motion=PhysicsEngine.motionSummary(state.data);const obj=state.target?.label||'手动选定目标';els.analysisObject.textContent=obj;els.analysisObjectDetail.textContent=state.target?.source==='ai'?'AI 检测目标':'视频手动选点';els.analysisMotion.textContent=motion.label;els.analysisMotionDetail.textContent=motion.detail;
    const last=state.data[state.data.length-1], maxV=Math.max(...state.data.map(d=>d.v)), maxA=Math.max(...state.data.map(d=>Math.abs(d.a)));
    const energy=last?`末帧机械能约 ${last.Em.toFixed(3)} J。`:'能量数据待定。';
    let rotTxt='';
    if(state.rotation && state.rotation.period){
      const r=state.rotation.period;
      const dir=state.rotation.direction===1?'逆时针':state.rotation.direction===-1?'顺时针':'—';
      rotTxt=`\n旋转分析：周期 T = ${r.value.toFixed(4)} s（${r.method==='zero-crossing'?'零穿法':'转圈法'}，${r.count} 个${r.method==='zero-crossing'?'完整周期':'完整圆周'}）\n平均角速度 ω̄ = ${state.rotation.avgOmega!=null?state.rotation.avgOmega.toFixed(4):'—'} rad/s\n旋转方向：${dir}`;
    }
    els.analysisSummary.textContent=`${state.fps?`视频平均帧率：${state.fps.toFixed(2)} fps`:'视频帧率：浏览器未能从容器中精确读取'}\n轨迹点：${state.data.length}\n最大速度：${maxV.toFixed(3)} m/s\n最大加速度：${maxA.toFixed(3)} m/s²\n${energy}${rotTxt}`;
  }
  function clearAnalysis(){els.analysisObject.textContent='—';els.analysisObjectDetail.textContent='先运行“识别目标”';els.analysisMotion.textContent='—';els.analysisMotionDetail.textContent='数据积累后自动判断';els.analysisSummary.textContent='上传视频、校准尺度并建立轨迹后，这里会给出面向物理实验的简要分析。';}

  const RAD2DEG=180/Math.PI;
  const chartLabels={t:'时间 / s',x:'位置 x / m',y:'位置 y / m',s:'沿轨位移 s / m',v:'速度 v / m/s',a:'加速度 a / m/s²',Ek:'动能 / J',Ep:'势能 / J',Em:'机械能 / J',theta:'摆角/极角 θ / °',omega:'角速度 ω / rad/s',r:'半径 r / m',vt:'切向速度 vₜ / m/s',vr:'径向速度 vᵣ / m/s'};
  const chartTips={
    't|x':'位移－时间曲线：斜率代表速度，适合判断运动快慢和是否匀速。',
    't|y':'竖直位移－时间曲线：适合观察下落、上升等运动。',
    't|v':'速度－时间曲线：斜率代表加速度，适合判断是否加速。',
    't|a':'加速度－时间曲线：观察加速度是否接近稳定值。',
    't|s':'沿轨位移－时间：适合斜面小车等实验。',
    't|Ek':'动能－时间：观察速度变化带来的动能变化。',
    't|Ep':'势能－时间：观察高度变化带来的势能变化。',
    't|Em':'机械能－时间：可用于观察机械能是否近似守恒。',
    't|theta':'摆角/极角－时间曲线：斜率代表角速度；单摆呈周期摆动，圆周运动单调变化。',
    't|omega':'角速度－时间曲线：圆周运动接近水平直线则近似恒定；单摆呈周期性变化。',
    't|r':'半径/摆长－时间曲线：接近水平说明绳长或旋转半径近似不变。',
    't|vt':'切向速度－时间曲线：圆周运动中 vt = r·ω。',
    't|vr':'径向速度－时间曲线：单摆与定半径圆周运动的 vr 约等于 0。'
  };
  const shortLabel=key=>String(chartLabels[key]||key).split(' / ')[0];
  function updateChartText(){
    const key=`${els.chartX.value}|${els.chartY.value}`;
    els.chartLegendText.textContent=`当前：${els.chartY.value}(${els.chartX.value})`;
    els.chartInterpretation.textContent=chartTips[key]||`当前显示 ${chartLabels[els.chartY.value]} 随 ${chartLabels[els.chartX.value]} 的变化。`;
    if(els.chartXRangeLabel)els.chartXRangeLabel.textContent=`横轴 ${shortLabel(els.chartX.value)}`;
    if(els.chartYRangeLabel)els.chartYRangeLabel.textContent=`纵轴 ${shortLabel(els.chartY.value)}`;
  }
  // 读取手动坐标范围：留空 = 该端自动
  function readChartRange(){
    const num=el=>{ if(!el)return undefined; const raw=String(el.value??'').trim(); if(raw==='')return undefined; const n=Number(raw); return Number.isFinite(n)?n:undefined; };
    return {xMin:num(els.chartXMin),xMax:num(els.chartXMax),yMin:num(els.chartYMin),yMax:num(els.chartYMax)};
  }
  function clearChartRange(){
    [els.chartXMin,els.chartXMax,els.chartYMin,els.chartYMax].forEach(el=>{if(el)el.value='';});
  }
  // ===== 频闪时间范围：① 纸带按该窗口重算 dt，且与 ② 的横轴（时间）双向同步 =====
  let syncingTime=false;
  function readTimeRange(){
    const num=el=>{ if(!el)return undefined; const raw=String(el.value??'').trim(); if(raw==='')return undefined; const n=Number(raw); return Number.isFinite(n)?n:undefined; };
    const min=num(els.strobeTimeMin), max=num(els.strobeTimeMax);
    if(min!=null&&max!=null&&min>=max){ toast('时间范围无效：起始需小于结束，本次按自动处理'); return null; }
    return {min,max};
  }
  function timeWindow(){
    const data=state.data;
    if(data.length<2)return {t0:0,tN:0,manual:false};
    const r=readTimeRange();
    const t0=data[0].t, tN=data[data.length-1].t;
    if(!r)return {t0,tN,manual:false};
    const lo=r.min!=null?Math.max(r.min,t0):t0, hi=r.max!=null?Math.min(r.max,tN):tN;
    if(!(hi-lo>1e-6))return {t0,tN,manual:false};
    return {t0:lo,tN:hi,manual:r.min!=null||r.max!=null};
  }
  function clearTimeRange(){ [els.strobeTimeMin,els.strobeTimeMax].forEach(el=>{if(el)el.value='';}); }
  // ① 的时间输入 → 同步到 ② 的横轴范围（仅当横轴为时间）
  function syncTimeFromStrobe(){
    if(syncingTime)return; syncingTime=true;
    try{
      if(els.chartX&&els.chartX.value==='t'){
        if(els.chartXMin)els.chartXMin.value=els.strobeTimeMin?els.strobeTimeMin.value:'';
        if(els.chartXMax)els.chartXMax.value=els.strobeTimeMax?els.strobeTimeMax.value:'';
        refreshChart();
      }
    }finally{ syncingTime=false; }
  }
  // ② 的横轴范围 → 同步回 ① 的时间输入并重算频闪
  function syncTimeFromChart(){
    if(syncingTime)return; syncingTime=true;
    try{
      if(els.chartX&&els.chartX.value==='t'){
        if(els.strobeTimeMin)els.strobeTimeMin.value=els.chartXMin?els.chartXMin.value:'';
        if(els.strobeTimeMax)els.strobeTimeMax.value=els.chartXMax?els.chartXMax.value:'';
        refreshTrajectory();
      }
    }finally{ syncingTime=false; }
  }
  // 切换横轴回到“时间”时，把 ① 已有的手动时间窗口带回 ② 的横轴输入框
  function carryTimeRangeToChart(){
    if(els.chartX&&els.chartX.value==='t'&&(String(els.strobeTimeMin?.value??'')!==''||String(els.strobeTimeMax?.value??'')!=='')){
      if(els.chartXMin)els.chartXMin.value=els.strobeTimeMin?.value??'';
      if(els.chartXMax)els.chartXMax.value=els.strobeTimeMax?.value??'';
    }
  }
  function refreshChart(){
    updateChartText();
    const unit=els.angleUnit?els.angleUnit.value:'deg';
    let dist=state.data, yLabel=chartLabels[els.chartY.value];
    if(els.chartY.value==='theta'){dist=state.data.map(d=>({...d,theta:unit==='rad'?d.thetaRad:d.thetaDeg}));yLabel=unit==='rad'?'θ / rad':'θ / °';}
    if(els.chartY.value==='omega'&&unit==='deg'){dist=state.data.map(d=>({...d,omega:Number.isFinite(d.omega)?d.omega*RAD2DEG:NaN}));yLabel='ω / °/s';}
    ChartEngine.draw(els.chartCanvas,dist,els.chartX.value,els.chartY.value,{x:chartLabels[els.chartX.value],y:yLabel},readChartRange());
    if(els.chartTooltip)els.chartTooltip.classList.add('hidden');
    markMiniActive(els.chartY.value);
  }

  // ===== 等时间间隔（频闪）分析：用“相同时间的位移变化量”初判运动类型 =====
  const STROBE_CANDIDATES=[0.02,0.04,0.05,0.1,0.2,0.25,0.5,1];
  function pickStrobeDt(win){
    const raw=els.strobeInterval?els.strobeInterval.value:'auto';
    if(raw&&raw!=='auto'){ const v=Number(raw); if(v>0)return v; }
    const dur=win?(win.tN-win.t0):0;
    if(!(dur>0))return 0.1;
    for(const c of STROBE_CANDIDATES){ const n=dur/c; if(n>=5&&n<=10)return c; }
    const c=STROBE_CANDIDATES[STROBE_CANDIDATES.length-1];
    return Math.max(1e-3,dur/Math.max(1,Math.round(dur/c)));
  }
  function interpSampleAt(t){
    const data=state.data; if(!data.length)return null;
    // state.data 与 state.pointsPx 一一对应（analyze 顺序不变），可同步插值回视频源坐标
    const pts=state.pointsPx, hasPx=pts.length===data.length;
    const pxAt=i=>hasPx?{x:pts[i].x,y:pts[i].y}:null;
    if(t<=data[0].t)return {...data[0],px:pxAt(0)};
    const last=data[data.length-1];
    if(t>=last.t)return {...last,px:pxAt(data.length-1)};
    let lo=0,hi=data.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1; if(data[mid].t<=t)lo=mid; else hi=mid;}
    const a=data[lo],b=data[hi],span=b.t-a.t,k=span>1e-9?(t-a.t)/span:0;
    const px=hasPx?{x:pts[lo].x+(pts[hi].x-pts[lo].x)*k, y:pts[lo].y+(pts[hi].y-pts[lo].y)*k}:null;
    return {t,x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,frame:Number.isFinite(a.frame)&&Number.isFinite(b.frame)?a.frame+(b.frame-a.frame)*k:undefined,px};
  }
  // 等时间间隔采样：每段位移取相邻两点位移矢量的大小（与运动方向无关，更稳健）
  function buildStrobeMarks(dt,win){
    const data=state.data; if(data.length<2)return {dt,marks:[]};
    const t0=win?win.t0:data[0].t, tN=win?win.tN:data[data.length-1].t;
    const n=Math.floor((tN-t0)/dt+1e-9);
    const marks=[]; let prev=null;
    for(let k=0;k<=n&&k<=400;k++){
      const s=interpSampleAt(t0+k*dt); if(!s)break;
      const mark={seq:k+1,t:s.t,x:s.x,y:s.y,frame:s.frame,px:s.px,ds:0,cum:0};
      if(prev){ mark.ds=Math.hypot(mark.x-prev.x,mark.y-prev.y); mark.cum=prev.cum+mark.ds; }
      marks.push(mark); prev=mark;
    }
    return {dt,marks};
  }
  // 用频闪位移序列判断运动类型：等量递增=匀加速，基本相等=匀速
  function analyzeStrobe(marks,dt){
    if(!marks||marks.length<3)return {label:'数据不足',level:'neutral',text:'轨迹点太少（或时间跨度太短），无法用频闪法判断运动类型。可增大采样点数或缩小频闪间隔。'};
    const ds=marks.slice(1).map(m=>m.ds);
    const n=ds.length, mean=ds.reduce((a,b)=>a+b,0)/n;
    const list=ds.map(v=>v.toFixed(3)).join(' → ');
    if(!(mean>1e-9))return {label:'接近静止',level:'warn',text:`每 ${dt.toFixed(3)} s 的位移都接近 0，物体几乎静止。`};
    const dev=Math.max(...ds.map(v=>Math.abs(v-mean)))/mean;
    if(dev<=0.12)return {label:'接近匀速',level:'good',text:`每 ${dt.toFixed(3)} s 的位移（单位 m）：${list}。各段基本相同（最大偏差 ${(dev*100).toFixed(0)}%）→ 接近匀速直线运动。`};
    const diffs=ds.slice(1).map((v,i)=>v-ds[i]);
    const dMean=diffs.reduce((a,b)=>a+b,0)/diffs.length;
    const rising=ds[n-1]>ds[0];
    if(dMean>0&&rising){
      const dDev=Math.max(...diffs.map(v=>Math.abs(v-dMean)))/Math.abs(dMean);
      if(dDev<=0.35){
        const a=dMean/(dt*dt);
        return {label:'匀加速',level:'good',text:`每 ${dt.toFixed(3)} s 的位移（单位 m）：${list}。逐段等量递增，每段多出约 ${dMean.toFixed(3)} m（相邻增量偏差 ${(dDev*100).toFixed(0)}%）→ 匀加速运动，估算 a = Δ(Δs)/Δt² ≈ ${a.toFixed(3)} m/s²。`};
      }
      return {label:'加速（加速度不匀）',level:'warn',text:`每 ${dt.toFixed(3)} s 的位移（单位 m）：${list}。整体递增但每段增量不恒定 → 加速运动，加速度在变化。`};
    }
    if(dMean<0&&!rising){
      const a=Math.abs(dMean)/(dt*dt);
      return {label:'减速',level:'warn',text:`每 ${dt.toFixed(3)} s 的位移（单位 m）：${list}。逐段减小 → 减速运动，平均减速度约 ${a.toFixed(3)} m/s²。`};
    }
    return {label:'规律不明显',level:'neutral',text:`每 ${dt.toFixed(3)} s 的位移（单位 m）：${list}。变化无明显统一规律，建议调整频闪间隔或检查跟踪质量。`};
  }
  function refreshStrobe(){
    if(!els.strobeCanvas)return null;
    const show=els.strobeToggle?els.strobeToggle.checked:true;
    const win=timeWindow();
    const {dt,marks}=buildStrobeMarks(pickStrobeDt(win),win);
    const winLabel=win.manual?`t ${win.t0.toFixed(2)}~${win.tN.toFixed(2)} s`:null;
    if(!show){
      ChartEngine.drawStrobeStrip(els.strobeCanvas,[]);
      if(els.strobeSummary)els.strobeSummary.textContent='已关闭等时间间隔标记；勾选“等时间间隔标记”后显示频闪分析。';
      if(els.strobeBadge){els.strobeBadge.textContent='已关闭';els.strobeBadge.className='quality-badge neutral';}
      return {dt,marks:[],win};
    }
    ChartEngine.drawStrobeStrip(els.strobeCanvas,marks,{dt,tLabel:winLabel});
    const res=state.data.length<2?{label:'等待数据',level:'neutral',text:'建立轨迹后，这里会按等时间间隔给出每段位移并初判运动类型。'}:analyzeStrobe(marks,dt);
    if(els.strobeSummary)els.strobeSummary.textContent=res.text;
    if(els.strobeBadge){els.strobeBadge.textContent=res.label;els.strobeBadge.className=`quality-badge ${res.level}`;}
    return {dt,marks,win};
  }
  function refreshTrajectory(){
    if(!els.trajectoryCanvas)return;
    const showStrobe=els.strobeToggle?els.strobeToggle.checked:true;
    const strobe=refreshStrobe();
    ChartEngine.drawXOY(els.trajectoryCanvas,state.data,{fps:state.fps,angle:Number(els.inclineAngle.value)||0,strobeMarks:strobe.marks,strobeDt:strobe.dt,showStrobe});
    if(els.trajectoryMeta){
      const angle=Number(els.inclineAngle.value)||0;
      const winTxt=strobe.win&&strobe.win.manual?` · 分析时段 ${strobe.win.t0.toFixed(2)}~${strobe.win.tN.toFixed(2)} s`:'';
      els.trajectoryMeta.textContent=state.data.length
        ? `X 向右、Y 向上 · 原点=${els.zeroAtStart.checked?'起始位置':'视频原点'} · ${state.data.length} 点${showStrobe?` · 频闪 ${strobe.dt.toFixed(3)} s`:''}${winTxt}${angle?` · 斜面角 ${angle.toFixed(1)}°`:''}`
        : '建立轨迹后自动显示运动路径；橙点=等时间间隔位置，标注为该段位移。';
    }
    drawOverlay(); // ①的间隔/时间窗口变化时，视频上的打点同步重绘
  }

  // 迷你趋势图网格：八张小图共用时间轴，一眼对比各物理量变化趋势
  const miniDefs=[
    {key:'x', name:'位置 x',    unit:'m',     color:'#2463eb'},
    {key:'y', name:'位置 y',    unit:'m',     color:'#0891b2'},
    {key:'s', name:'沿轨位移 s',unit:'m',     color:'#378add'},
    {key:'v', name:'速度 v',    unit:'m/s',   color:'#16855b'},
    {key:'a', name:'加速度 a',  unit:'m/s²',  color:'#c2410c'},
    {key:'Ek',name:'动能 Ek',   unit:'J',     color:'#7c5cd6'},
    {key:'Ep',name:'势能 Ep',   unit:'J',     color:'#a16207'},
    {key:'Em',name:'机械能 Em', unit:'J',     color:'#5b21b6'}
  ];
  const rotMiniDefs=[
    {key:'theta', name:'摆角/极角 θ', unit:'°',     color:'#d97706'},
    {key:'omega', name:'角速度 ω',    unit:'rad/s', color:'#be185d'}
  ];
  function buildMiniCards(){
    if(!els.miniChartGrid)return;
    els.miniChartGrid.innerHTML='';
    (state.rotationMode?[...miniDefs,...rotMiniDefs]:miniDefs).forEach(def=>{
      const card=document.createElement('div');
      card.className='mini-card'; card.dataset.y=def.key; card.title=`点击在主图中放大 ${def.name}－时间曲线`;
      card.innerHTML=`<div class="mini-card-head"><span class="mini-name" style="--mc:${def.color}">${def.name}<i>${def.unit}</i></span><b class="mini-value">—</b></div><canvas class="mini-canvas"></canvas><div class="mini-range"><span>min —</span><span>max —</span></div>`;
      const cv=card.querySelector('.mini-canvas'), val=card.querySelector('.mini-value');
      cv.addEventListener('mousemove',e=>{
        const hit=ChartEngine.hitTest(cv,e);
        if(hit&&state.data.length){ if(cv.__redraw)cv.__redraw(); ChartEngine.drawCrosshair(cv,hit); val.textContent=fmt(hit.data[def.key],3); }
      });
      cv.addEventListener('mouseleave',()=>{ if(cv.__redraw)cv.__redraw(); val.textContent=card.__peak||'—'; });
      card.addEventListener('click',()=>{ els.chartX.value='t'; els.chartY.value=def.key; document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active')); clearChartRange(); carryTimeRangeToChart(); refreshChart(); });
      els.miniChartGrid.appendChild(card);
    });
  }
  function refreshMiniCharts(){
    if(!els.miniChartGrid||!els.miniChartGrid.children.length)return;
    els.miniChartGrid.querySelectorAll('.mini-card').forEach(card=>{
      const unit=els.angleUnit?els.angleUnit.value:'deg';
      const allDefs=state.rotationMode?[...miniDefs,...rotMiniDefs]:miniDefs;
      const def=allDefs.find(d=>d.key===card.dataset.y); if(!def)return;
      const ui=card.querySelector('.mini-name i');
      if(def.key==='theta'){if(ui)ui.textContent=unit==='rad'?'rad':'°';}
      else if(def.key==='omega'){if(ui)ui.textContent=unit==='rad'?'rad/s':'°/s';}
      const cv=card.querySelector('.mini-canvas'), val=card.querySelector('.mini-value'), rng=card.querySelectorAll('.mini-range span');
      let miniData=state.data;
      if(def.key==='theta')miniData=state.data.map(d=>({...d,theta:unit==='rad'?d.thetaRad:d.thetaDeg}));
      else if(def.key==='omega'&&unit==='deg')miniData=state.data.map(d=>({...d,omega:Number.isFinite(d.omega)?d.omega*RAD2DEG:NaN}));
      const redraw=()=>{
        if(cv.__chartMeta&&cv.__chartMeta.data!==miniData){cv.__chartMeta=null;}
        ChartEngine.drawMini(cv,miniData,def.key,{color:def.color});
      };
      cv.__redraw=redraw; redraw();
      const vs=miniData.map(d=>Number(d[def.key])).filter(Number.isFinite);
      if(vs.length){
        const mn=Math.min(...vs), mx=Math.max(...vs);
        card.__peak='峰 '+fmt(mx,2);
        val.textContent=card.__peak;
        rng[0].textContent='min '+fmt(mn,2);
        rng[1].textContent='max '+fmt(mx,2);
      }else{
        card.__peak='—'; val.textContent='—'; rng[0].textContent='min —'; rng[1].textContent='max —';
      }
    });
    markMiniActive(els.chartY.value);
  }
  function markMiniActive(yKey){
    if(!els.miniChartGrid)return;
    els.miniChartGrid.querySelectorAll('.mini-card').forEach(c=>c.classList.toggle('active',c.dataset.y===yKey&&els.chartX.value==='t'));
  }
  els.refreshChartBtn.addEventListener('click',refreshChart);
  els.refreshTrajectoryBtn?.addEventListener('click',refreshTrajectory);
  els.strobeToggle?.addEventListener('change',refreshTrajectory);
  els.strobeInterval?.addEventListener('change',refreshTrajectory);
  els.videoStrobeToggle?.addEventListener('change',()=>{drawOverlay();toast(els.videoStrobeToggle.checked?'已在视频上叠加等时间打点':'已隐藏视频上的等时间打点');});
  els.rotationMarkerToggle?.addEventListener('change',()=>drawOverlay());
  [els.strobeTimeMin,els.strobeTimeMax].forEach(el=>el?.addEventListener('input',()=>{refreshTrajectory();syncTimeFromStrobe();}));
  els.strobeTimeAutoBtn?.addEventListener('click',()=>{
    clearTimeRange();
    if(els.chartX&&els.chartX.value==='t'){clearChartRange();refreshChart();}
    refreshTrajectory(); toast('已恢复全时段分析，频闪间隔按总时长重新选取');
  });
  [els.chartXMin,els.chartXMax,els.chartYMin,els.chartYMax].forEach(el=>el?.addEventListener('input',()=>{refreshChart();syncTimeFromChart();}));
  els.chartAutoRangeBtn?.addEventListener('click',()=>{
    clearChartRange();
    if(els.chartX&&els.chartX.value==='t'){clearTimeRange();refreshTrajectory();}
    refreshChart(); toast('已恢复为自动坐标范围');
  });
  window.addEventListener('resize',()=>{refreshChart();refreshTrajectory();refreshMiniCharts();});
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));btn.classList.add('active');$('tab-'+btn.dataset.tab).classList.add('active');state.tab=btn.dataset.tab;if(btn.dataset.tab==='charts'){refreshTrajectory();refreshChart();refreshMiniCharts();}}));

  function download(text,name,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  els.csvBtn.addEventListener('click',()=>{
    if(!state.data.length)return toast('暂无轨迹数据');
    const esc=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
    const rows=[['序号','视频帧号','时间_s','x_m','y_m','s_m','vx_m_s','vy_m_s','v_m_s','ax_m_s2','ay_m_s2','a_m_s2','Ek_J','Ep_J','Em_J','theta_deg','theta_rad','omega_rad_s','omega_deg_s','r_m','vt_m_s','vr_m_s'],
      ...state.data.map((d,i)=>[i+1,Number.isFinite(d.frame)?d.frame:(Number.isFinite(d.t)?Math.round(d.t*(state.fps||30)):i),Number(d.t).toFixed(6),d.x,d.y,d.s,d.vx,d.vy,d.v,d.ax,d.ay,d.a,d.Ek,d.Ep,d.Em,d.thetaDeg,d.thetaRad,d.omega,Number.isFinite(d.omega)?d.omega*180/Math.PI:NaN,d.r,d.vt,d.vr])];
    download('\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\r\n'),'物理视频分析数据.csv','text/csv;charset=utf-8');
    toast(`CSV 已导出：${state.data.length} 个采样点，包含帧号与时间`);
  });
  els.jsonBtn.addEventListener('click',()=>{if(!state.file)return toast('暂无项目');download(JSON.stringify({version:'V1',file:state.file.name,fps:state.fps,duration:state.duration,metersPerPx:state.metersPerPx,target:state.target,pivot:state.pivotPx,rotation:state.rotation,pointsPx:state.pointsPx,data:state.data},null,2),'物理视频分析项目.json','application/json');});
  els.reportBtn.addEventListener('click',()=>{if(!state.data.length)return toast('暂无分析数据');download(els.analysisSummary.textContent,'实验分析摘要.txt','text/plain;charset=utf-8');});

  els.resetBtn.addEventListener('click',()=>location.reload());
  [els.mass,els.gravity,els.zeroHeight,els.inclineAngle,els.invertY,els.zeroAtStart,els.smoothRange].forEach(e=>e.addEventListener('change',()=>{if(state.pointsPx.length)finalizeData(); else refreshTrajectory();}));

  els.tablePageSize?.addEventListener('change',()=>{state.tablePage=1;renderTable();});
  els.angleUnit?.addEventListener('change',()=>{if(state.data.length){renderTable();if(state.tab==='charts')refreshChart();refreshMiniCharts();}});
  els.prevPageBtn?.addEventListener('click',()=>{state.tablePage--;renderTable();});
  els.nextPageBtn?.addEventListener('click',()=>{state.tablePage++;renderTable();});
  els.dataTableBody?.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-frame]'); if(!row)return;
    const frame=Number(row.dataset.frame);
    if(Number.isFinite(frame)&&state.fps){
      els.video.pause(); els.video.currentTime=Math.min(els.video.duration||0,Math.max(0,frame/state.fps));
      state.currentTrackedPoint=state.pointsPx[Number(row.dataset.index)]||state.currentTrackedPoint;
      drawOverlay();setHud();
      els.dataTableBody.querySelectorAll('tr').forEach(r=>r.classList.remove('selected-row')); row.classList.add('selected-row');
    }
  });
  document.querySelectorAll('.preset-btn').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
    els.chartX.value=btn.dataset.x;els.chartY.value=btn.dataset.y;clearChartRange();carryTimeRangeToChart();refreshChart();
  }));
  [els.chartX,els.chartY].forEach(sel=>sel.addEventListener('change',()=>{document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));clearChartRange();carryTimeRangeToChart();refreshChart();}));

  // 主图框选缩放：拖动矩形 → 直接设定横纵轴范围
  let chartDrag=null;
  const canvasToData=(m,px,py)=>({xv:m.xmin+(px-m.pad.l)/m.pw*(m.xmax-m.xmin),yv:m.ymin+(m.pad.t+m.ph-py)/m.ph*(m.ymax-m.ymin)});
  const setRangeInput=(el,v)=>{if(el)el.value=String(Number(v.toPrecision(6)));};
  els.chartCanvas?.addEventListener('pointerdown',e=>{
    if(!state.data.length)return;
    const m=els.chartCanvas.__chartMeta; if(!m)return;
    const r=els.chartCanvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    if(x<m.pad.l||x>m.pad.l+m.pw||y<m.pad.t||y>m.pad.t+m.ph)return;
    chartDrag={x0:x,y0:y,x1:x,y1:y,moved:false};
    els.chartCanvas.setPointerCapture?.(e.pointerId);
  });
  els.chartCanvas?.addEventListener('pointermove',e=>{
    if(!chartDrag)return;
    const r=els.chartCanvas.getBoundingClientRect();
    chartDrag.x1=e.clientX-r.left; chartDrag.y1=e.clientY-r.top;
    if(Math.abs(chartDrag.x1-chartDrag.x0)>3||Math.abs(chartDrag.y1-chartDrag.y0)>3)chartDrag.moved=true;
    refreshChart();
    ChartEngine.drawSelection(els.chartCanvas,chartDrag);
  });
  els.chartCanvas?.addEventListener('pointerup',()=>{
    if(!chartDrag)return;
    const drag=chartDrag; chartDrag=null;
    const m=els.chartCanvas.__chartMeta;
    const wpx=Math.abs(drag.x1-drag.x0), hpx=Math.abs(drag.y1-drag.y0);
    if(!drag.moved||!m||wpx<14||hpx<14){refreshChart();return;}
    const lo=canvasToData(m,Math.min(drag.x0,drag.x1),Math.max(drag.y0,drag.y1));
    const hi=canvasToData(m,Math.max(drag.x0,drag.x1),Math.min(drag.y0,drag.y1));
    setRangeInput(els.chartXMin,lo.xv); setRangeInput(els.chartXMax,hi.xv);
    setRangeInput(els.chartYMin,lo.yv); setRangeInput(els.chartYMax,hi.yv);
    if(els.chartX.value==='t'&&hi.xv>lo.xv){ setRangeInput(els.strobeTimeMin,lo.xv); setRangeInput(els.strobeTimeMax,hi.xv); refreshTrajectory(); }
    refreshChart();
    toast('已按框选区域设定坐标范围（时间已同步到①频闪分析），点“自动范围”可还原');
  });
  els.chartCanvas?.addEventListener('pointercancel',()=>{chartDrag=null;refreshChart();});

  els.chartCanvas?.addEventListener('mousemove',e=>{
    if(chartDrag)return;
    if(!state.data.length||!els.chartTooltip)return;
    const unit=els.angleUnit?els.angleUnit.value:'deg';
    const yTipLabel=k=>k==='theta'?(unit==='rad'?'摆角/极角 θ / rad':'摆角/极角 θ / °'):k==='omega'?(unit==='rad'?'角速度 ω / rad/s':'角速度 ω / °/s'):chartLabels[k];
    refreshChart();
    const hit=ChartEngine.hitTest(els.chartCanvas,e);
    if(!hit)return;
    ChartEngine.drawCrosshair(els.chartCanvas,hit);
    const d=hit.data;
    els.chartTooltip.innerHTML=`<b>第 ${Number.isFinite(d.frame)?d.frame+1:'—'} 帧</b><br>t = ${fmt(d.t,3)} s<br>${chartLabels[els.chartX.value]} = ${fmt(d[els.chartX.value],4)}<br>${yTipLabel(els.chartY.value)} = ${fmt(d[els.chartY.value],4)}`;
    els.chartTooltip.style.left=`${Math.min(Math.max(8,hit.canvasX+12),els.chartCanvas.clientWidth-178)}px`;
    els.chartTooltip.style.top=`${Math.max(8,hit.canvasY-80)}px`;
    els.chartTooltip.classList.remove('hidden');
  });
  els.chartCanvas?.addEventListener('mouseleave',()=>els.chartTooltip?.classList.add('hidden'));
  updateTrackButton();
  refreshTrajectory();
  buildMiniCards();
  refreshMiniCharts();
  setHud();
})();
