window.TrackingEngine = (() => {
  function centerFromDetection(det) {
    if (det.centroid) return { x: det.centroid.x, y: det.centroid.y, w: det.bbox[2], h: det.bbox[3] };
    return { x: det.bbox[0] + det.bbox[2]/2, y: det.bbox[1] + det.bbox[3]/2, w:det.bbox[2], h:det.bbox[3] };
  }

  function cropTemplate(ctx, x, y, radius) {
    const sx = Math.max(0, Math.floor(x-radius));
    const sy = Math.max(0, Math.floor(y-radius));
    const sw = Math.min(ctx.canvas.width-sx, Math.floor(radius*2+1));
    const sh = Math.min(ctx.canvas.height-sy, Math.floor(radius*2+1));
    if (sw < 5 || sh < 5) return null;
    return ctx.getImageData(sx, sy, sw, sh);
  }

  function rgbToHsv(r,g,b){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0;
    if(d){
      if(max===r)h=((g-b)/d)%6;
      else if(max===g)h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h/=6;if(h<0)h+=1;
    }
    return {h,s:max?d/max:0,v:max};
  }

  // 从种子点附近采样颜色，生成“目标外观模型”。
  // 色相使用圆周均值（sin/cos），否则红色/紫色这类跨越 0/1 的颜色会平均成错误的颜色。
  // 同时保留归一化 RGB 色度均值与离散度，用于低饱和（白/灰/黑）目标的匹配。
  function sampleColorModel(img, cx, cy, radius=10){
    const {width:w,height:h,data}=img;
    const sx=Math.max(0,Math.floor(cx-radius)), ex=Math.min(w-1,Math.floor(cx+radius));
    const sy=Math.max(0,Math.floor(cy-radius)), ey=Math.min(h-1,Math.floor(cy+radius));
    const mk=()=>({n:0,hx:0,hy:0,hn:0,s:0,v:0,r:0,g:0,b:0,rr:0,gg:0,bb:0});
    const acc=mk(), all=mk();
    const add=(a,R,G,B,hsv)=>{
      const tot=Math.max(1e-6,R+G+B);
      const nr=R/tot, ng=G/tot, nb=B/tot;
      a.n++; a.s+=hsv.s; a.v+=hsv.v;
      a.r+=nr; a.g+=ng; a.b+=nb; a.rr+=nr*nr; a.gg+=ng*ng; a.bb+=nb*nb;
      // 只有足够饱和的像素才有可靠色相；灰/白像素的 hue 无意义，会污染均值。
      if(hsv.s>=0.15){ const ang=hsv.h*Math.PI*2; a.hx+=Math.cos(ang); a.hy+=Math.sin(ang); a.hn++; }
    };
    for(let y=sy;y<=ey;y+=2) for(let x=sx;x<=ex;x+=2){
      const i=(y*w+x)*4; const R=data[i],G=data[i+1],B=data[i+2];
      const hsv=rgbToHsv(R,G,B);
      add(all,R,G,B,hsv);
      if(hsv.v<0.10) continue;                 // 过暗像素
      if(hsv.s<0.10 && hsv.v>0.96) continue;   // 高光/纯白像素
      add(acc,R,G,B,hsv);
    }
    const a=acc.n>=4?acc:all;
    if(!a.n)return null;
    let hAvg=a.hn?Math.atan2(a.hy,a.hx)/(Math.PI*2):0; if(hAvg<0)hAvg+=1;
    const nr=a.r/a.n, ng=a.g/a.n, nb=a.b/a.n;
    const sAvg=a.s/a.n, vAvg=a.v/a.n;
    const std=Math.sqrt(Math.max(0,(a.rr/a.n-nr*nr)+(a.gg/a.n-ng*ng)+(a.bb/a.n-nb*nb)));
    const res={ h:hAvg, s:sAvg, v:vAvg, nr, ng, nb, std, colorful:sAvg>=0.25 && vAvg>=0.15 };
    // 以用户点击的中心像素为准做校正：中心是暗色物体时按暗色匹配；
    // 中心是高饱和颜色时确保启用彩色匹配（采样窗口混入背景时尤其重要）。
    const cxi=Math.max(0,Math.min(w-1,Math.round(cx))), cyi=Math.max(0,Math.min(h-1,Math.round(cy)));
    const ci=(cyi*w+cxi)*4;
    const cHsv=rgbToHsv(data[ci],data[ci+1],data[ci+2]);
    if(cHsv.v<0.22 && cHsv.s<0.30){ res.colorful=false; res.v=Math.min(res.v,cHsv.v); }
    else if(cHsv.s>=0.35 && cHsv.v>=0.20){ res.colorful=true; res.s=Math.max(res.s,cHsv.s); }
    return res;
  }

  function hueDistance(a,b){const d=Math.abs(a-b);return Math.min(d,1-d);}

  // 目标与模型是否同色：彩色目标用色相/饱和度/明度；低饱和或暗色目标
  // 退化为归一化 RGB 色度匹配或亮度匹配，从而支持白/灰/黑等任意颜色。
  function colorMatch(R,G,B,hsv,model){
    if(!model)return false;
    if(!model.colorful && model.v<0.22) return hsv.v < Math.max(0.35, model.v+0.20);
    if(hsv.v<0.10)return false;
    if(model.colorful){
      const hd=hueDistance(hsv.h,model.h);
      const sd=Math.abs(hsv.s-model.s);
      const vd=Math.abs(hsv.v-model.v);
      return hd<0.13 && sd<0.42 && vd<0.50 && hsv.s>0.18;
    }
    const tot=Math.max(1e-6,R+G+B);
    const nr=R/tot, ng=G/tot, nb=B/tot;
    const dist=Math.sqrt((nr-model.nr)**2+(ng-model.ng)**2+(nb-model.nb)**2);
    const tol=Math.max(0.045, model.std*2.6);
    return dist<tol && Math.abs(hsv.v-model.v)<0.55;
  }

  function getFrame(ctx,video){
    const cw=ctx.canvas.width,ch=ctx.canvas.height;
    ctx.clearRect(0,0,cw,ch);ctx.drawImage(video,0,0,cw,ch);
    return ctx.getImageData(0,0,cw,ch);
  }

  // 在局部区域寻找与目标颜色相符的连续区域。与单纯颜色质心相比，连通域
  // 更不容易被背景上的零散同色像素拉偏；跟踪锚点使用“按匹配强度加权的质心”，
  // 在目标被部分遮挡或边缘破碎时比外接框中心更稳定。
  function detectColorCandidates(img,{minArea=100, roi=null, model=null, step=2}={}){
    const {width:w,height:h,data}=img;
    const x0=Math.max(0,Math.floor(roi?.x||0));
    const y0=Math.max(0,Math.floor(roi?.y||0));
    const x1=Math.min(w-1,Math.floor((roi?.x||0)+(roi?.w||w)-1));
    const y1=Math.min(h-1,Math.floor((roi?.y||0)+(roi?.h||h)-1));
    const gw=Math.max(1,Math.ceil((x1-x0+1)/step)), gh=Math.max(1,Math.ceil((y1-y0+1)/step));
    const mask=new Uint8Array(gw*gh);
    const weight=new Float32Array(gw*gh);
    for(let gy=0;gy<gh;gy++){
      const y=Math.min(y1,y0+gy*step);
      for(let gx=0;gx<gw;gx++){
        const x=Math.min(x1,x0+gx*step); const i=(y*w+x)*4;
        const R=data[i],G=data[i+1],B=data[i+2];
        const hsv=rgbToHsv(R,G,B);
        let hit=false, wt=1;
        if(model){
          if(colorMatch(R,G,B,hsv,model)){ hit=true; wt=model.colorful?Math.max(0.2,hsv.s):1; }
        } else if(hsv.h>=0.48 && hsv.h<=0.76 && hsv.s>=0.38 && hsv.v>=0.14){
          hit=true; wt=Math.max(0.2,hsv.s);
        }
        if(hit){ mask[gy*gw+gx]=1; weight[gy*gw+gx]=wt; }
      }
    }
    // 阈值随帧宽自适应：小分辨率画面里目标像素本来就少，固定阈值会漏检。
    const minAreaPx=Math.max(24, minArea*Math.pow(w/720,2));
    const visited=new Uint8Array(mask.length), comps=[];
    const queue=new Int32Array(mask.length);
    for(let idx=0;idx<mask.length;idx++){
      if(!mask[idx]||visited[idx])continue;
      let head=0,tail=0;queue[tail++]=idx;visited[idx]=1;
      let area=0,minX=gw,maxX=0,minY=gh,maxY=0,sumW=0,sumWX=0,sumWY=0;
      while(head<tail){
        const cur=queue[head++], x=cur%gw, y=Math.floor(cur/gw);
        const wt=weight[cur];
        area++; minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        sumW+=wt; sumWX+=x*wt; sumWY+=y*wt;
        const nbs=[cur-1,cur+1,cur-gw,cur+gw];
        for(const ni of nbs){
          if(ni<0||ni>=mask.length||visited[ni]||!mask[ni])continue;
          const nx=ni%gw;
          if(ni===cur-1 && nx!==x-1)continue;
          if(ni===cur+1 && nx!==x+1)continue;
          visited[ni]=1;queue[tail++]=ni;
        }
      }
      const pxArea=area*step*step;
      if(pxArea<minAreaPx)continue;
      const bx=x0+minX*step, by=y0+minY*step;
      const bw=(maxX-minX+1)*step, bh=(maxY-minY+1)*step;
      const safeW=sumW>1e-6?sumW:area;
      const wcx=x0+(sumWX/safeW)*step, wcy=y0+(sumWY/safeW)*step;
      comps.push({x:bx,y:by,w:bw,h:bh,area:pxArea,cx:bx+bw/2,cy:by+bh/2,wcx,wcy});
    }
    comps.sort((a,b)=>b.area-a.area);
    return comps;
  }

  function sadPatch(frameData, fw, fh, tpl, cx, cy, searchRadius) {
    const tw=tpl.width,th=tpl.height,td=tpl.data;
    const halfW=Math.floor(tw/2),halfH=Math.floor(th/2);
    const clX=x=>Math.max(halfW,Math.min(fw-halfW-1,Math.round(x)));
    const clY=y=>Math.max(halfH,Math.min(fh-halfH-1,Math.round(y)));
    const score=(x,y,cutoff)=>{
      x=clX(x); y=clY(y);
      let err=0;
      const lim=cutoff==null?Infinity:cutoff;
      for(let j=0;j<th;j+=2){
        for(let i=0;i<tw;i+=2){
          const a=((y-halfH+j)*fw+(x-halfW+i))*4;
          const b=(j*tw+i)*4;
          err+=Math.abs(frameData[a]-td[b])+Math.abs(frameData[a+1]-td[b+1])+Math.abs(frameData[a+2]-td[b+2]);
          if(err>=lim)return err;   // 已不可能优于当前最优，提前退出
        }
      }
      return err;
    };
    // 第一级：在预测位置附近逐像素搜索。预测通常已经很准，逐像素可避免
    // 因步长过大而完全跳过尖锐的匹配峰（高纹理目标尤其明显）。
    let best={score:Infinity,x:clX(cx),y:clY(cy)};
    const cx0=clX(cx), cy0=clY(cy);
    const localR=Math.min(searchRadius,28);
    for(let y=clY(cy0-localR);y<=clY(cy0+localR);y++){
      for(let x=clX(cx0-localR);x<=clX(cx0+localR);x++){
        const s=score(x,y,best.score);
        if(s<best.score)best={score:s,x,y};
      }
    }
    // 第二级：若搜索半径更大（快速运动），再用步长 2 覆盖整个范围兜底；
    // 借助第一级得到的 cutoff 提前剪枝，几乎不影响速度。
    if(searchRadius>localR){
      for(let y=clY(cy0-searchRadius);y<=clY(cy0+searchRadius);y+=2){
        for(let x=clX(cx0-searchRadius);x<=clX(cx0+searchRadius);x+=2){
          const s=score(x,y,best.score);
          if(s<best.score)best={score:s,x,y};
        }
      }
    }
    // 精搜：在最优位置 ±2 内逐像素，补回步长 2 跳过的奇数坐标。
    const fx0=best.x, fy0=best.y;
    for(let y=clY(fy0-2);y<=clY(fy0+2);y++){
      for(let x=clX(fx0-2);x<=clX(fx0+2);x++){
        const s=score(x,y,best.score);
        if(s<best.score)best={score:s,x,y};
      }
    }
    // 抛物线亚像素插值：在最优整数位置左右/上下各取一点拟合，得到亚像素偏移。
    // 这里必须用完整（不提前剪枝）的误差值，否则拟合会失真。
    const s0=best.score;
    const sL=score(best.x-1,best.y), sR=score(best.x+1,best.y);
    const sU=score(best.x,best.y-1), sD=score(best.x,best.y+1);
    const denX=sL-2*s0+sR, denY=sU-2*s0+sD;
    let dx=denX>1e-9?0.5*(sL-sR)/denX:0;
    let dy=denY>1e-9?0.5*(sU-sD)/denY:0;
    dx=Math.max(-0.5,Math.min(0.5,dx)); dy=Math.max(-0.5,Math.min(0.5,dy));
    return {score:best.score, x:best.x+dx, y:best.y+dy, tw, th};
  }

  function waitForSeek(video,time){
    return new Promise((resolve,reject)=>{
      let done=false;
      const cleanup=()=>{
        video.removeEventListener('seeked',onSeeked);
        video.removeEventListener('error',onError);
        clearTimeout(timer);
      };
      const finish=(fn,val)=>{if(done)return;done=true;cleanup();fn(val);};
      const onSeeked=()=>finish(resolve);
      const onError=(e)=>finish(reject,e instanceof Error?e:new Error('视频定位失败'));
      const timer=setTimeout(()=>finish(reject,new Error('视频逐帧定位超时')),1800);
      video.addEventListener('seeked',onSeeked,{once:true});
      video.addEventListener('error',onError,{once:true});
      try { video.currentTime=Math.max(0,Math.min(video.duration||time,time)); }
      catch(e){ finish(reject,e); }
    });
  }

  async function seekFrameExact(video, frameIndex, fps, frameCtx, lastTimeRef){
    const t=Math.max(0,Math.min(video.duration||0,frameIndex/(fps||30)));
    if(Math.abs(t-(lastTimeRef.value||0))>1e-7){
      video.pause();
      await waitForSeek(video,t);
      lastTimeRef.value=video.currentTime;
    }
    return getFrame(frameCtx,video);
  }

  async function trackPlayback({video,frameCtx,startPoint,startFrame=0,trackerMode='visual',fps=30,totalFrames:totalFramesArg,centerMode='weighted',sampleRadius,pivot=null,pivotRadius=null,onPoint,onFinish,onProgress,onModeInfo}) {
    let running=true;
    let stopRequested=false;
    let lastPoint={...startPoint};
    let previousCenter=null;
    let lastCenter={x:startPoint.x,y:startPoint.y};
    let velocity={x:0,y:0};
    const duration=video.duration||0;
    const totalFrames=Math.max(1,Number(totalFramesArg)||Math.round((fps||30)*duration));
    const lastTimeRef={value:-1};
    // 从用户点选目标的那一帧开始跟踪（默认仍为 0），保证模板与颜色模型
    // 采样的就是目标所在的帧，而不是错误地假设目标在第 0 帧的位置。
    const startIdx=Math.max(0,Math.min(totalFrames-1,Math.round(Number(startFrame)||0)));
    const firstImg=await seekFrameExact(video,startIdx,fps,frameCtx,lastTimeRef);
    const baseRadius=Math.max(16,Math.min(65,Math.max(startPoint.w||24,startPoint.h||24)*.55));
    let template=cropTemplate(frameCtx,lastPoint.x,lastPoint.y,baseRadius);
    if(!template)throw new Error('无法建立目标模板，请重新点选物体较清晰的位置。');
    const colorModel=sampleColorModel(firstImg,lastPoint.x,lastPoint.y,sampleRadius);
    let colorAnchorOffset={x:0,y:0};
    let initialArea=0;
    let initialAspect=1;
    let useColor=((trackerMode==='visual'||trackerMode==='pendulum') && !!colorModel);
    const centerKey=centerMode==='bbox'?'cx':'wcx';
    const candCenter=(c)=>({x:c[centerKey],y:centerMode==='bbox'?c.cy:c.wcy});

    if(useColor){
      const roi={x:Math.max(0,lastPoint.x-120),y:Math.max(0,lastPoint.y-100),w:Math.min(frameCtx.canvas.width,lastPoint.x+120)-Math.max(0,lastPoint.x-120),h:Math.min(frameCtx.canvas.height,lastPoint.y+100)-Math.max(0,lastPoint.y-100)};
      // Use step=1 for rotation modes (pendulum/circle) for better precision
      const step = trackerMode==='pendulum' ? 1 : 2;
      const comps=detectColorCandidates(firstImg,{minArea:80,roi,model:colorModel,step});
      let best=comps[0],bestDist=Infinity;
      for(const c of comps){
        const cc=candCenter(c);
        const d=Math.hypot(cc.x-lastPoint.x,cc.y-lastPoint.y);
        if(d<bestDist){bestDist=d;best=c;}
      }
      if(best && bestDist<Math.max(100,baseRadius*3.5)){
        const cc=candCenter(best);
        colorAnchorOffset={x:lastPoint.x-cc.x,y:lastPoint.y-cc.y};
        initialArea=best.area;
        initialAspect=best.w/Math.max(1,best.h);
      } else useColor=false;
    }

    onModeInfo?.(trackerMode==='pendulum'
      ? (pivot&&pivotRadius ? '单摆小球跟踪：颜色/模板识别 + 悬挂点半径环约束，逐帧处理。' : '单摆小球跟踪：颜色 + 模板识别，逐帧处理。')
      : (useColor?'已锁定目标外观：采用预测 + 连通区域跟踪，不跟随屏幕播放速度。':'采用模板跟踪 + 预测位置；分析将逐帧处理。'));

    const finish=()=>{
      if(!running)return;
      running=false;stopRequested=true;video.pause();onFinish?.();
    };

    try {
      for(let frameIndex=startIdx;frameIndex<totalFrames && running;frameIndex++){
        const img=await seekFrameExact(video,frameIndex,fps,frameCtx,lastTimeRef);
        if(stopRequested||!running)break;
        let confidence=0.25;
        if(frameIndex===startIdx){
          onPoint?.({t:frameIndex/(fps||30),x:lastPoint.x,y:lastPoint.y,frame:frameIndex,confidence:1});
        }else{
          const predicted={x:lastCenter.x+velocity.x,y:lastCenter.y+velocity.y};
          let candidate=null;

          if(useColor){
            const speed=Math.hypot(velocity.x,velocity.y);
            const searchRadius=Math.min(260,Math.max(70,baseRadius*3 + speed*2.4 + 24));
            const roi={x:Math.max(0,predicted.x-searchRadius),y:Math.max(0,predicted.y-searchRadius),w:Math.min(frameCtx.canvas.width,predicted.x+searchRadius)-Math.max(0,predicted.x-searchRadius),h:Math.min(frameCtx.canvas.height,predicted.y+searchRadius)-Math.max(0,predicted.y-searchRadius)};
            // Use step=1 for rotation modes (pendulum/circle) for better precision
            const step = trackerMode==='pendulum' ? 1 : 2;
            const comps=detectColorCandidates(img,{minArea:60,roi,model:colorModel,step});
            let best=null,bestScore=Infinity;
            for(const c of comps){
              const cc=candCenter(c);
              const dist=Math.hypot(cc.x-predicted.x,cc.y-predicted.y);
              if(dist>searchRadius)continue;
              if(pivot && pivotRadius){
                const err=Math.abs(Math.hypot(cc.x-pivot.x,cc.y-pivot.y)-pivotRadius);
                if(err>pivotRadius*0.4)continue;
                const areaRatio=initialArea?Math.abs(Math.log((c.area+1)/(initialArea+1))):0;
                const aspectRatio=initialAspect?Math.abs(Math.log((c.w/Math.max(1,c.h))/initialAspect)):0;
                const score=dist + err*8 + areaRatio*22 + aspectRatio*18 - Math.min(c.area,initialArea||c.area)*0.0008;
                if(score<bestScore){bestScore=score;best=c;}
              }else{
                const areaRatio=initialArea?Math.abs(Math.log((c.area+1)/(initialArea+1))):0;
                const aspectRatio=initialAspect?Math.abs(Math.log((c.w/Math.max(1,c.h))/initialAspect)):0;
                const score=dist + areaRatio*22 + aspectRatio*18 - Math.min(c.area,initialArea||c.area)*0.0008;
                if(score<bestScore){bestScore=score;best=c;}
              }
            }
            if(best){
              const cc=candCenter(best);
              candidate={x:cc.x+colorAnchorOffset.x,y:cc.y+colorAnchorOffset.y};
              const jump=Math.hypot(candidate.x-lastPoint.x,candidate.y-lastPoint.y);
              const maxJump=Math.max(70,baseRadius*3 + speed*2.8 + 30);
              if(jump<=maxJump){
                const dist=Math.hypot(cc.x-predicted.x,cc.y-predicted.y);
                confidence=Math.max(.65,Math.min(.99,1-dist/Math.max(1,searchRadius)));
              }else candidate=null;
              if(best && confidence>.7 && frameIndex%6===0){initialArea=initialArea*0.92+best.area*0.08;initialAspect=initialAspect*0.92+(best.w/Math.max(1,best.h))*0.08;}
            }
          }

          if(!candidate){
            const speed=Math.hypot(velocity.x,velocity.y);
            const searchRadius=Math.min(220,Math.max(55,baseRadius*2.4+speed*2.1+20));
            const best=sadPatch(img.data,img.width,img.height,template,predicted.x,predicted.y,searchRadius);
            // 按实际参与比较的像素数计算误差上限，使置信度可比、可解释。
            const samples=Math.ceil(template.width/2)*Math.ceil(template.height/2);
            const maxError=samples*255*3;
            confidence=Math.max(0,1-best.score/Math.max(1,maxError));
            candidate={x:best.x,y:best.y};
            // 圆弧约束兜底：模板候选若明显偏离悬挂点半径环，直接放弃本帧候选，
            // 让位置停在上一帧，避免被背景高对比区域带走导致跳变。
            if(pivot && pivotRadius){
              const err=Math.abs(Math.hypot(best.x-pivot.x,best.y-pivot.y)-pivotRadius);
              if(err>pivotRadius*0.4){ candidate=null; confidence=Math.min(confidence,0.3); }
            }
          }

          const alpha=confidence>=.6?0.85:0.55;
          let filtered;
          if(!candidate){ filtered={x:lastPoint.x,y:lastPoint.y}; }
          else { filtered={x:lastPoint.x*(1-alpha)+candidate.x*alpha,y:lastPoint.y*(1-alpha)+candidate.y*alpha}; }
          previousCenter=lastCenter;
          lastCenter={x:filtered.x,y:filtered.y};
          velocity={x:lastCenter.x-previousCenter.x,y:lastCenter.y-previousCenter.y};
          lastPoint={...lastCenter};
          onPoint?.({t:frameIndex/(fps||30),x:lastPoint.x,y:lastPoint.y,frame:frameIndex,confidence});
          if(confidence>.55 && frameIndex%5===0){template=cropTemplate(frameCtx,lastPoint.x,lastPoint.y,baseRadius)||template;}
        }
        const done=frameIndex-startIdx+1, span=Math.max(1,totalFrames-startIdx);
        onProgress?.(done/span,done,performance.now());
      }
    } finally {
      finish();
    }
    return ()=>finish();
  }

  function refineByTemplate(frameCtx,x,y,radius=12,searchRadius=15){
    const tpl=cropTemplate(frameCtx,x,y,radius);
    if(!tpl)return null;
    const fw=frameCtx.canvas.width,fh=frameCtx.canvas.height;
    const imgData=frameCtx.getImageData(0,0,fw,fh);
    const best=sadPatch(imgData.data,imgData.width,imgData.height,tpl,x,y,searchRadius);
    if(!best)return null;
    const samples=Math.ceil(tpl.width/2)*Math.ceil(tpl.height/2);
    const maxError=samples*255*3;
    if(best.score>maxError*0.4)return null;
    return {x:best.x,y:best.y,w:tpl.width,h:tpl.height};
  }

  function refineColoredSeed(img,cx,cy,{maxRadius=140,minArea=60,step=2,radius=10,centerMode='weighted'}={}){
    const model=sampleColorModel(img,cx,cy,radius);
    const roi={x:Math.max(0,cx-maxRadius),y:Math.max(0,cy-maxRadius),w:maxRadius*2,h:maxRadius*2};
    const candidates=detectColorCandidates(img,{minArea,roi,model,step});
    const key=centerMode==='bbox'?'cx':'wcx';
    let best=null,bestDist=Infinity;
    for(const c of candidates){const d=Math.hypot(c[key]-cx,c[key]-cy);if(d<bestDist){bestDist=d;best=c;}}
    return best;
  }

  return {centerFromDetection,getFrame,trackPlayback,detectColorCandidates,detectBlueCandidates:detectColorCandidates,refineColoredSeed,refineByTemplate,sampleColorModel};
})();
