export interface PricePoint { price: number; recordedAt: Date | string; sourceReliability?: number }
export interface PriceIntelligence { status: 'likely-decrease' | 'stable' | 'likely-increase' | 'insufficient-data'; confidence: 'high' | 'medium' | 'low'; current: number | null; lowest: number | null; highest: number | null; average: number | null; range: [number, number] | null; sampleSize: number; modelVersion: 'linear-trend-v1'; disclaimer: string }

export function analyzePriceHistory(input: PricePoint[], minimumPoints = 12): PriceIntelligence {
  const valid = input.map(item => ({ price: item.price, time: new Date(item.recordedAt).getTime() })).filter(item => Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.time)).sort((a,b)=>a.time-b.time);
  if (valid.length < minimumPoints || valid[valid.length - 1].time - valid[0].time < 30 * 86_400_000) return { status: 'insufficient-data', confidence: 'low', current: valid.at(-1)?.price ?? null, lowest: null, highest: null, average: null, range: null, sampleSize: valid.length, modelVersion: 'linear-trend-v1', disclaimer: 'Insufficient historical data; this is not a price guarantee.' };
  const sorted = valid.map(item=>item.price).sort((a,b)=>a-b); const q1=sorted[Math.floor(sorted.length*.25)], q3=sorted[Math.floor(sorted.length*.75)], iqr=q3-q1;
  const clean=valid.filter(item=>item.price>=q1-1.5*iqr&&item.price<=q3+1.5*iqr); const mean=clean.reduce((s,p)=>s+p.price,0)/clean.length;
  const xs=clean.map((_,i)=>i), xMean=(xs.length-1)/2; const slope=clean.reduce((s,p,i)=>s+(i-xMean)*(p.price-mean),0)/(clean.reduce((s,_,i)=>s+(i-xMean)**2,0)||1);
  const residual=Math.sqrt(clean.reduce((s,p,i)=>s+(p.price-(mean+slope*(i-xMean)))**2,0)/clean.length); const projected=clean.at(-1)!.price+slope*4; const change=(projected-clean.at(-1)!.price)/clean.at(-1)!.price;
  const status=Math.abs(change)<.025?'stable':change<0?'likely-decrease':'likely-increase'; const confidence=clean.length>=24&&residual/mean<.08?'high':clean.length>=16?'medium':'low';
  return { status, confidence, current: clean.at(-1)!.price, lowest: Math.min(...clean.map(p=>p.price)), highest: Math.max(...clean.map(p=>p.price)), average: Math.round(mean), range: [Math.max(0,Math.round(projected-1.96*residual)),Math.round(projected+1.96*residual)], sampleSize: clean.length, modelVersion: 'linear-trend-v1', disclaimer: 'Statistical estimate from recorded prices, not a guarantee or financial advice.' };
}
