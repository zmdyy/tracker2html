/* Minimal MP4 parser for extracting average video frame rate from stts/mdhd/hdlr. */
window.MP4Parser = (() => {
  const text = (u8, start, len) => String.fromCharCode(...u8.slice(start, start + len));
  const u32 = (dv, p) => dv.getUint32(p, false);
  const u64 = (dv, p) => Number(dv.getBigUint64(p, false));

  function boxes(u8, start, end) {
    const out = [];
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = start;
    while (p + 8 <= end) {
      let size = u32(dv, p);
      const type = text(u8, p + 4, 4);
      let header = 8;
      if (size === 1) { if (p + 16 > end) break; size = u64(dv, p + 8); header = 16; }
      if (size === 0) size = end - p;
      if (size < header || p + size > end) break;
      out.push({ type, start:p, size, header, dataStart:p+header, dataEnd:p+size });
      p += size;
    }
    return out;
  }

  function findChildren(u8, box, types) {
    return boxes(u8, box.dataStart, box.dataEnd).filter(b => types.includes(b.type));
  }

  async function getFps(file) {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    const root = { dataStart: 0, dataEnd: u8.length };
    const moov = boxes(u8, 0, u8.length).find(b => b.type === 'moov');
    if (!moov) throw new Error('不是标准 MP4/MOV 容器或无法解析。');

    const tracks = findChildren(u8, moov, ['trak']);
    for (const trak of tracks) {
      const mdia = findChildren(u8, trak, ['mdia'])[0];
      if (!mdia) continue;
      const hdlr = findChildren(u8, mdia, ['hdlr'])[0];
      if (!hdlr) continue;
      const handler = text(u8, hdlr.dataStart + 8, 4);
      if (handler !== 'vide') continue;
      const mdhd = findChildren(u8, mdia, ['mdhd'])[0];
      const minf = findChildren(u8, mdia, ['minf'])[0];
      if (!mdhd || !minf) continue;
      const stbl = findChildren(u8, minf, ['stbl'])[0];
      if (!stbl) continue;
      const stts = findChildren(u8, stbl, ['stts'])[0];
      const version = u8[mdhd.dataStart];
      const timescalePos = mdhd.dataStart + (version === 1 ? 20 : 12);
      const timescale = u32(dv, timescalePos);
      const sttsVersion = u8[stts.dataStart];
      const entryCount = u32(dv, stts.dataStart + 4);
      let p = stts.dataStart + 8;
      let samples = 0;
      let duration = 0;
      for (let i = 0; i < entryCount && p + 8 <= stts.dataEnd; i++) {
        const count = u32(dv, p); const delta = u32(dv, p+4);
        samples += count; duration += count * delta; p += 8;
      }
      if (!timescale || !duration || !samples) continue;
      const seconds = duration / timescale;
      return { fps: samples / seconds, samples, duration: seconds, timescale, method: 'MP4 stts' };
    }
    throw new Error('未找到视频轨道时间表 stts。');
  }

  return { getFps };
})();
